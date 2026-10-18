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
