import { mix } from '../core/color';
import { fromHsl, pullHue, toHsl } from './hsl';

/**
 * LUMIÈRE PROPRE AUX CHEVEUX (`resolveAppearance(base, spec, { model: 'hair' })`). Remplace, pour les cheveux et les poils seulement, `deriveLight` de `resolve.ts`.
 *
 * Défaut corrigé (mesuré, `docs/HAIR-PASS9.md`) : `deriveLight` prend une teinte de reflet BLEUTÉE (h = 218°) dès que `l < 0,22`. Le seuil est une falaise : le brun `#4a3326`
 * (l = 0,219) sortait avec la lumière `#7d95bf` (bleu ardoise), un brun à l = 0,221 avec une lumière chaude. Tous les tons positifs se mélangent vers `light` : les mèches
 * éclairées d'une chevelure brune se lisaient bleu ardoise, et seules les mèches à ton ≤ 0 restaient brunes.
 *
 * Règle : le reflet bleuté n'appartient qu'au NOIR (cheveux très sombres ET peu saturés : noir-bleu de l'encre et de l'anime), il est donc pondéré par DEUX rampes continues,
 * luminosité et neutralité. Un brun foncé est saturé : son reflet reste dans sa famille (brun clair, chaud). Aucune discontinuité : le poids varie sans saut avec (l, s).
 */
const WARM_HUE = 48;
const COOL_HUE = 195;
/** Reflet du noir (HSL) : bleu froid, même teinte et saturation que la branche d'origine. */
const BLACK_SHEEN = { h: 218, s: 0.34 } as const;
/** Rampes du poids du reflet bleuté : plein jusqu'à `L.from`, nul à partir de `L.to` en luminosité ; plein jusqu'à `S.from`, nul à partir de `S.to` en saturation. */
export const BLUE_SHEEN = { L: { from: 0.12, to: 0.26 }, S: { from: 0.22, to: 0.45 } } as const;

const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Poids ∈ [0, 1] du reflet bleuté pour une couleur de base (l, s en HSL). 1 = noir franc, 0 = toute autre couleur. */
export const blueSheenWeight = (l: number, s: number): number => (1 - smooth(BLUE_SHEEN.L.from, BLUE_SHEEN.L.to, l)) * (1 - smooth(BLUE_SHEEN.S.from, BLUE_SHEEN.S.to, s));

/** Branche chaude / froide de `deriveLight` (inchangée) : éclaircie, saturation tempérée, décalage vers le chaud ou le froid selon la famille de teinte. */
function familyLight(base: string): string {
  const c = toHsl(base);
  const target = c.h < 110 || c.h >= 300 ? WARM_HUE : COOL_HUE;
  const p = pullHue(c, target, 0.22);
  return fromHsl({ h: p.h, s: p.s * 0.78, l: Math.min(0.9, p.l + (1 - p.l) * 0.5) });
}

export function deriveHairLight(base: string): string {
  const c = toHsl(base);
  const w = blueSheenWeight(c.l, c.s);
  const family = familyLight(base);
  if (w <= 1e-6) return family;
  const black = fromHsl({ h: BLACK_SHEEN.h, s: BLACK_SHEEN.s, l: Math.min(0.62, c.l * 2.6 + 0.28) });
  return w >= 1 - 1e-6 ? black : mix(family, black, w);
}
