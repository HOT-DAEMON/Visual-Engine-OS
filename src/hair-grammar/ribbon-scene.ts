import { eyeInk } from './eye-slot';
import { ribbonPath, solidPath, tonePath, type Ribbon, type RibbonProfile } from './ribbon';

/** Palette de la scène au trait : encre, papier. Les gris des bandes de ton viennent du profil (mesurés sur la référence). */
export interface RibbonStyle { readonly ink: string; readonly paper: string; readonly widthScale: number; readonly minW: number }
export const RIBBON_STYLE: RibbonStyle = { ink: '#111111', paper: '#ffffff', widthScale: 1, minW: 0.3 };
const hex = (g: number): string => { const h = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0'); return `#${h}${h}${h}`; };

/** Un ruban n'a un dégradé propre que si son gris mesuré dépasse ce seuil quelque part (sinon : noir commun). */
export const GRADIENT_MIN_GRAY = 90;
/** Gain sur le gris mesuré : la pointe est déjà amincie par l'effilement, éclaircir en plus compterait deux fois le fondu. */
export const GRADIENT_GAIN = 0.7;
const GRAY_FLOOR = 17; const GRAY_CEIL = 215; const STOPS = 5;
const f1 = (v: number): string => (Math.round(v * 10) / 10).toString();
/** Dégradé linéaire racine → pointe d'un ruban (axe = premier → dernier point, en pixels de cellule). */
function ribbonGradient(r: Ribbon, id: string, f: { ox: number; oy: number; unit: number }): string | null {
  const g = r.g; const n = r.p.length;
  if (!g || g.length !== n || n < 2) return null;
  const a = r.p[0] as readonly number[]; const b = r.p[n - 1] as readonly number[];
  const x1 = f.ox + (a[0] as number) * f.unit; const y1 = f.oy + (a[1] as number) * f.unit; const x2 = f.ox + (b[0] as number) * f.unit; const y2 = f.oy + (b[1] as number) * f.unit;
  if (Math.hypot(x2 - x1, y2 - y1) < 0.5) return null;
  const stops = Array.from({ length: STOPS }, (_, k) => { const i = Math.round((k * (n - 1)) / (STOPS - 1)); return `<stop offset="${f1((i / (n - 1)) * 100)}%" stop-color="${hex(Math.max(GRAY_FLOOR, Math.min(GRAY_CEIL, (g[i] as number) * GRADIENT_GAIN)))}"/>`; }).join('');
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}">${stops}</linearGradient>`;
}

/** Scène à bandes : un `<path>` évenodd par seuil, du plus clair au plus sombre. Le dernier seuil porte l'encre : son gris est remplacé par l'encre de la scène. */
export function bandScene(P: RibbonProfile, view: { w: number; h: number; px: number }, st: RibbonStyle = RIBBON_STYLE): string {
  const b = P.bands ?? []; const last = b.length - 1;
  const paths = b.map((q, i) => `<path d="${q.d}" fill="${i === last ? st.ink : hex(q.gray)}" fill-rule="evenodd"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.w} ${view.h}" width="${view.w * view.px}" height="${view.h * view.px}"><rect width="100%" height="100%" fill="${st.paper}"/>${paths}</svg>`;
}

/**
 * Scène complète, ordre de peinture : papier → bandes de ton (claires puis sombres) → masses pleines → rubans fins.
 * SVG de chemins uniquement (aucun filtre) ; une seule balise `<path>` par bande et une pour toute l'encre → peu de nœuds, rastérisation rapide.
 */
export function ribbonScene(P: RibbonProfile, view: { w: number; h: number; px: number }, st: RibbonStyle = RIBBON_STYLE, rolesIn: ReadonlySet<string> = new Set(['hair', 'face']), layers: 'auto' | 'bands' | 'ribbons' = 'auto'): string {
  // Profil à bandes iso-tons précompilées : papier → bandes (claires puis sombres) ; aucun chemin à reconstruire (construction = concaténation).
  if (P.bands && layers !== 'ribbons') return bandScene(P, view, st);
  const f = P.frame;
  // Si le profil porte une place d'œil, le vrai moteur d'yeux remplace l'encre tracée du rôle `eye` ; sinon la trace est conservée.
  const eye = P.eyeSlot ? eyeInk(P.eyeSlot) : null;
  const roles = eye ? rolesIn : new Set([...rolesIn, 'eye']);
  const tones = [...P.tones].sort((a, b) => a.level - b.level).map((t) => `<path d="${tonePath(t, f)}" fill="${hex(t.gray)}" fill-rule="evenodd"/>`).join('');
  const solids = P.solids.filter((s) => roles.has(s.role)).map((s) => solidPath(s, f)).join(' ');
  // Rubans à gris mesuré clair quelque part : remplis un à un par un dégradé racine → pointe ; les autres restent dans le trait noir commun.
  const kept = P.ribbons.filter((r) => roles.has(r.role));
  const isGrad = (r: Ribbon): boolean => !!r.g && Math.max(...r.g) > GRADIENT_MIN_GRAY;
  const gradDefs: string[] = []; const gradPaths: string[] = [];
  const flat: Ribbon[] = [];
  for (const r of kept) {
    const d = isGrad(r) ? ribbonPath(r, f, st.widthScale, st.minW) : '';
    const id = `rg${r.id}`; const gr = d ? ribbonGradient(r, id, f) : null;
    if (d && gr) { gradDefs.push(gr); gradPaths.push(`<path d="${d}" fill="url(#${id})"/>`); } else flat.push(r);
  }
  const ink = flat.map((r) => ribbonPath(r, f, st.widthScale, st.minW)).filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.w} ${view.h}" width="${view.w * view.px}" height="${view.h * view.px}"><defs>${eye ? eye.defs : ''}${gradDefs.join('')}</defs><rect width="100%" height="100%" fill="${st.paper}"/>${tones}${eye ? eye.markup : ''}<path d="${solids} ${ink}" fill="${st.ink}" fill-rule="nonzero"/>${gradPaths.join('')}</svg>`;
}
