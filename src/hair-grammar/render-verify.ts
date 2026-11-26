import { hueDelta, toHsl, type ResolvedAppearance } from '../appearance';
import type { HairLock } from '../face/hair/types';

/**
 * VÉRIFICATION DU RENDU PRINCIPAL d'une coiffure issue de la grammaire (passe 9), en trois couches, sur ce qui est RÉELLEMENT remis au rendu (`HairLock` + apparence résolue) :
 *   - GÉOMÉTRIE : un reflet transversal est une bande LISSE (bords sans dentelure) ; mesuré avant correction : bords à 0,40–0,82 de la largeur de la bande, dessinés en « W » blancs ;
 *   - ANATOMIE  : déjà couverte, sans doublon ici, par `compose-verify.ts` / `verify.ts` (portée par repères du visage, zones protégées) et `ring-check.ts` (reflet dans la lame) ;
 *   - STYLE     : fidélité de teinte : les tons ÉCLAIRÉS d'une chevelure restent dans la famille de sa couleur (un brun ne devient pas bleu ardoise).
 * Ne rastérise rien (pas de dépendance au moteur de rendu) : la mesure par pixels vit dans `scripts/hair-grammar/artefacts-pass9.ts` et dans les tests.
 */
export interface RenderIssue { readonly layer: 'geometry' | 'anatomy' | 'style'; readonly code: string; readonly detail: string; readonly lock?: number }

/** Alternances de signe tolérées sur un bord de reflet (0 : un bord lisse, droit ou courbe, ne change jamais de sens de courbure). */
export const ZIGZAG_MAX = 0;
/** Un écart à la corde ne compte que s'il dépasse cette fraction de l'épaisseur de la bande : les points alignés d'un bord droit ne donnent que du bruit numérique (premier détecteur de la passe 9 : invalide pour cette raison). */
export const ZIGZAG_MIN_DEV = 0.03;
/** Dérive de teinte maximale (degrés) d'un ton éclairé par rapport à la couleur de base, pour une couleur franche (s > 0,25, l > 0,08). Ingénierie : l'harmonie analogue de `hair-look.ts` borne l'ombre à 30° ; la lumière doit rester dans la même famille. */
export const LIT_HUE_MAX = 45;

type P = { readonly x: number; readonly y: number };

/**
 * Alternances de sens de courbure d'un bord (liste de points). Un bord lisse, droit ou en arc, vaut 0 ; une dentelure en vaut une par dent.
 * `scale` : épaisseur de la bande, qui fixe l'écart minimal significatif.
 */
export function edgeZigzag(edge: readonly P[], scale: number): number {
  let flips = 0; let prev = 0;
  for (let j = 1; j < edge.length - 1; j++) {
    const a = edge[j - 1] as P; const b = edge[j] as P; const c = edge[j + 1] as P;
    const L = Math.hypot(c.x - a.x, c.y - a.y) || 1;
    const dev = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / L; // écart signé de b à la corde ac
    if (Math.abs(dev) < ZIGZAG_MIN_DEV * scale) continue;
    const s = Math.sign(dev); if (prev && s !== prev) flips++; prev = s;
  }
  return flips;
}

/** Alternances totales des deux longs bords d'une bande de reflet (`HairLockRing.highlight` = bord haut puis bord bas inversé). */
export function bandZigzag(highlight: readonly P[]): number {
  if (highlight.length < 6) return 0;
  const n = highlight.length >> 1; const top = highlight.slice(0, n); const bot = highlight.slice(n);
  const a = top[0] as P; const b = bot[bot.length - 1] as P; const thick = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  return edgeZigzag(top, thick) + edgeZigzag(bot, thick);
}

/** Dérive de teinte maximale (degrés, 0–180) des tons éclairés `tones` de `ra` par rapport à sa base. 0 pour une base grise ou très sombre (pas de famille de teinte : mesure sans objet). */
export function litHueDrift(ra: ResolvedAppearance, tones: readonly number[] = [0.25, 0.5, 0.75, 1]): number {
  const b = toHsl(ra.base); if (b.s <= 0.25 || b.l <= 0.08) return 0;
  return tones.reduce((m, v) => Math.max(m, Math.abs(hueDelta(b.h, toHsl(ra.tone(v)).h))), 0);
}

/** Fautes du rendu principal d'une coiffure : géométrie des reflets, puis fidélité de teinte. Liste vide = rien à signaler. */
export function checkMainRender(locks: readonly HairLock[], ra: ResolvedAppearance): RenderIssue[] {
  const out: RenderIssue[] = [];
  locks.forEach((l, lock) => {
    const r = l.geom?.ring; if (!r) return;
    const z = bandZigzag(r.highlight);
    if (z > ZIGZAG_MAX) out.push({ layer: 'geometry', code: 'ring.band-smooth', detail: `bords du reflet dentelés (${z} alternances de courbure)`, lock });
  });
  const d = litHueDrift(ra);
  if (d > LIT_HUE_MAX) out.push({ layer: 'style', code: 'style.lit-hue', detail: `un ton éclairé dérive de ${d.toFixed(0)}° par rapport à la couleur des cheveux (max ${LIT_HUE_MAX}°)` });
  return out;
}
