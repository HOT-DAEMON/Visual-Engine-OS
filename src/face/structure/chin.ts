import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { chinShape } from '../jaw/structure';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt } from '../outline';
import type { Derived } from './dependencies';
import type { ChinGeo } from './types';

/**
 * Menton (T5) : les neuf contrôles du cahier des charges (D), MESURÉS sur le contour réel plutôt que déduits des paramètres :
 * largeur, hauteur, projection, rondeur (rapport de largeurs), symphyse (largeur, profondeur), fossette, sillon, transitions supérieure / latérales / inférieure.
 * Les transitions lisent `Derived` : c'est là que la projection du menton recalcule les raccords sans toucher à la mandibule.
 */
export function chinGeometry(p: FaceParams, lm: FaceLandmarks, d: Derived): ChinGeo {
  const { W, H } = lm;
  const o = lm.outline;
  const half = o.chinHalf;
  const h = lm.chin.heightPx;
  const bottom = o.bottomY;
  const corner = o.keys.chinCorner;
  const shape = chinShape(p);
  // Rondeur MESURÉE : largeur du contour à 15 % de la hauteur du menton au-dessus du bas, rapportée à la largeur au coin du menton.
  const flatness = half > 0 ? halfWidthAt(o, bottom - 0.15 * h) / half : 0;
  // Symphyse : largeur du bas (à 6 % de la hauteur) et profondeur verticale (coin du menton → bas).
  const symphysis = { widthPx: 2 * halfWidthAt(o, bottom - 0.06 * h), depthPx: bottom - corner.y };
  const dim = p.chin.dimple;
  const groove: Vec[] = [{ x: 0, y: lm.chin.sulcusY + 0.3 * h }, { x: 0, y: lm.chinY - 0.12 * h }];
  // Transitions : supérieure (sillon labio-mentonnier, creusée selon la dépendance), latérales (largeur = raccord recalculé), inférieure (sous-menton).
  const upper = { c: { x: 0, y: lm.chin.sulcusY }, rx: Math.min(lm.lips.half * 0.85, half * 1.5), ry: (0.008 + 0.014 * p.chin.upperBlend) * H * (0.6 + 0.8 * d.upperBlendDepth), rotDeg: 0 };
  const lat = (s: -1 | 1): ChinGeo['lateral']['left'] => ({ c: { x: s * (half + 0.5 * d.lateralBlendPx), y: corner.y - 0.02 * H }, rx: 0.6 * d.lateralBlendPx, ry: 0.04 * H, rotDeg: s * 20 });
  const lower = { c: { x: 0, y: lm.chinY + 0.015 * H }, rx: half * 1.2, ry: Math.max(0.004 * H, 0.5 * d.submentalReachPx), rotDeg: 0 };
  return {
    widthPx: 2 * half,
    heightPx: h,
    projectionPx: lm.chin.projectionPx,
    flatness: shape.pointed && flatness > 0.6 ? 0.6 : flatness,
    symphysis,
    // Fossette ronde : rayon de 1,5 à 4,5 % de W selon `dimple` (jamais nul : le polygone reste valide même à 0).
    dimple: { c: { x: 0, y: lm.chin.sulcusY + 0.62 * h }, rx: (0.005 + 0.03 * dim) * W, ry: (0.004 + 0.024 * dim) * W, rotDeg: 0 },
    groove,
    upper,
    lateral: { left: lat(-1), right: lat(1) },
    lower,
  };
}
