import { halfWidthAt } from './outline';
import { rotate } from './curve';
import type { FaceLandmarks } from './landmarks';
import type { Vec } from '../geometry/eye/primitives';
import type { FaceParams } from '../schema';
import type { Poly } from './poly';

/** Oreille : centre, demi-axes, inclinaison et polygone (repère de l'hôte). Source unique du rendu, des ombres de contact et de la vérification. */
export interface EarGeo {
  readonly side: -1 | 1;
  readonly c: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly tiltDeg: number;
  readonly poly: Poly;
}

/** Oreilles posées sur le contour entre la ligne des yeux et la base du nez ; vide si `ears.visible` est faux. */
export function earGeometry(p: FaceParams, lm: FaceLandmarks): EarGeo[] {
  if (!p.ears.visible) return [];
  const w = p.ears.size * lm.W;
  const h = w * p.ears.aspect;
  const cy = (lm.eyeY + lm.noseBaseY) / 2;
  return ([-1, 1] as const).map((side) => {
    const c = { x: side * (halfWidthAt(lm.outline, cy) + w * 0.18), y: cy };
    const tilt = side * p.ears.tiltDeg;
    const poly: Poly = Array.from({ length: 28 }, (_, i) => {
      const a = (2 * Math.PI * i) / 28;
      const r = rotate({ x: (w / 2) * Math.cos(a), y: (h / 2) * Math.sin(a) }, tilt);
      return { x: c.x + r.x, y: c.y + r.y };
    });
    return { side, c, rx: w / 2, ry: h / 2, tiltDeg: tilt, poly };
  });
}
