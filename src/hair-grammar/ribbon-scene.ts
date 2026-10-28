import { ribbonPath, solidPath, tonePath, type RibbonProfile } from './ribbon';

/** Palette de la scène au trait : encre, papier. Les gris des bandes de ton viennent du profil (mesurés sur la référence). */
export interface RibbonStyle { readonly ink: string; readonly paper: string; readonly widthScale: number; readonly minW: number }
export const RIBBON_STYLE: RibbonStyle = { ink: '#111111', paper: '#ffffff', widthScale: 1, minW: 0.3 };
const hex = (g: number): string => { const h = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0'); return `#${h}${h}${h}`; };

/**
 * Scène complète, ordre de peinture : papier → bandes de ton (claires puis sombres) → masses pleines → rubans fins.
 * SVG de chemins uniquement (aucun filtre) ; une seule balise `<path>` par bande et une pour toute l'encre → peu de nœuds, rastérisation rapide.
 */
export function ribbonScene(P: RibbonProfile, view: { w: number; h: number; px: number }, st: RibbonStyle = RIBBON_STYLE, roles: ReadonlySet<string> = new Set(['hair', 'face'])): string {
  const f = P.frame;
  const tones = [...P.tones].sort((a, b) => a.level - b.level).map((t) => `<path d="${tonePath(t, f)}" fill="${hex(t.gray)}" fill-rule="evenodd"/>`).join('');
  const solids = P.solids.filter((s) => roles.has(s.role)).map((s) => solidPath(s, f)).join(' ');
  const ink = P.ribbons.filter((r) => roles.has(r.role)).map((r) => ribbonPath(r, f, st.widthScale, st.minW)).filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.w} ${view.h}" width="${view.w * view.px}" height="${view.h * view.px}"><rect width="100%" height="100%" fill="${st.paper}"/>${tones}<path d="${solids} ${ink}" fill="${st.ink}" fill-rule="nonzero"/></svg>`;
}
