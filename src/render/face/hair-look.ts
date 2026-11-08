import { mix, luminance } from '../../core/color';
import { resolveAppearance, type ResolvedAppearance } from '../../appearance';
import type { Appearance, FaceParams } from '../../schema';

/**
 * Apparence résolue de la chevelure. Le dégradé racine → pointe vient, par ordre de priorité, de
 * `appearance.gradient` (N stops explicites) puis de `look.tipColor` / `look.midColor` (couleur de base jusqu'à
 * `1 − tipReach`, puis transition vers le milieu et la pointe). Sans rien : couleur unie (teintes d'ombre et de
 * lumière dérivées par le moteur d'apparence).
 */
export function hairAppearance(h: FaceParams['hair']): ResolvedAppearance {
  const spec: Appearance = h.appearance;
  if (spec.gradient.length > 0 || !h.look.tipColor) return resolveAppearance(h.color, spec);
  const a = (1 - h.look.tipReach) * 0.6;
  const stops = h.look.midColor
    ? [{ offset: 0, color: h.color, opacity: 1 }, { offset: a, color: h.color, opacity: 1 }, { offset: a + (1 - a) * 0.5, color: h.look.midColor, opacity: 1 }, { offset: 1, color: h.look.tipColor, opacity: 1 }]
    : [{ offset: 0, color: h.color, opacity: 1 }, { offset: 1 - h.look.tipReach, color: h.color, opacity: 1 }, { offset: 1, color: h.look.tipColor, opacity: 1 }];
  return resolveAppearance(h.color, { ...spec, gradient: stops });
}

/** Ton relatif de la masse arrière : celui des mèches arrière qu'elle double (`tone` −0,25 … −0,45 dans `generate` des mèches pendantes). */
export const BACK_MASS_TONE = -0.4;

/**
 * Teinte de la masse arrière (sous-couche derrière la tête) : le ton MOYEN des mèches arrière, donc jamais plus sombre que ce qu'elle double.
 * L'ancienne teinte (`mix(mix(base, ombre, 0,8), noir, 0,2)`) valait 0,27–0,37 × la luminance des cheveux : une masse noire visible entre et au-delà
 * des mèches. Source unique pour le rendu ET la vérification.
 */
export const backMassColor = (ra: ResolvedAppearance): string => ra.tone(BACK_MASS_TONE);

/** Luminance minimale de la sous-couche racine, en fraction de celle des cheveux : des racines foncées (repousse), jamais un casque noir sous des mèches claires. */
export const ROOT_MIN_RATIO = 0.42;

/**
 * Teinte de la sous-couche racine (coque). `rootColor` explicite (repousse brune sur cheveux teints, 15 % des visages) ou ombre à 55 %. Mesuré avant :
 * rapport de luminance racine / cheveux jusqu'à 0,02 (#2b2320 sous #c58614) : un dôme noir sous des mèches clairsemées, où le reflet satin de la coque
 * se lit comme un trou gris. La teinte est ramenée vers la couleur des cheveux juste assez pour atteindre `ROOT_MIN_RATIO` (dichotomie, direction de teinte conservée).
 * Source unique pour le rendu ET la vérification (`crown-tone-not-black`).
 */
export function rootColorOf(ra: ResolvedAppearance, h: FaceParams['hair']): string {
  const root = h.rootColor ?? mix(ra.base, ra.shadow, 0.55);
  const lum = luminance(ra.base);
  if (lum < 0.02 || luminance(root) >= ROOT_MIN_RATIO * lum) return root;
  let lo = 0, hi = 1;
  for (let i = 0; i < 8; i++) {
    const m = (lo + hi) / 2;
    if (luminance(mix(root, ra.base, m)) >= ROOT_MIN_RATIO * lum) hi = m;
    else lo = m;
  }
  return mix(root, ra.base, hi);
}
