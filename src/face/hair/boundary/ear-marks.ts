import type { FaceParams } from '../../../schema';
import { earGeometry } from '../../ears-geometry';
import type { FaceLandmarks } from '../../landmarks';

export interface EarSpan {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Hauteur de chaque oreille (ordonnées haut / bas) : l'oreille RÉELLEMENT dessinée quand elle est visible (même géométrie que le rendu),
 * sinon l'oreille que le visage aurait (même formule que `earGeometry`). La lisière contourne l'oreille même si elle est masquée : une
 * oreille n'est pas un cuir chevelu.
 */
export function earSpans(p: FaceParams, lm: FaceLandmarks): { readonly left: EarSpan; readonly right: EarSpan } {
  const geo = earGeometry(p, lm);
  const of = (sg: -1 | 1): EarSpan => {
    const g = geo.find((e) => e.side === sg);
    if (g) {
      const ys = g.poly.map((q) => q.y);
      return { top: Math.min(...ys), bottom: Math.max(...ys) };
    }
    const h = p.ears.size * lm.W * p.ears.aspect;
    const cy = (lm.eyeY + lm.noseBaseY) / 2;
    return { top: cy - h / 2, bottom: cy + h / 2 };
  };
  return { left: of(-1), right: of(1) };
}
