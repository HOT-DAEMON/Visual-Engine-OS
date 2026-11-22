import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import { pt } from './plan-geom';

/** Outils géométriques de l'intérieur du pavillon (plan canonique) : transformations de polygones autour d'un pivot (conque : volume, inclinaison ; fosse : orientation). */

/** Rotation d'un polygone de `deg` degrés autour de `c` (sens horaire en repère SVG). */
export function rotAbout(poly: Poly, c: Vec, deg: number): Poly {
  if (deg === 0) return poly;
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  return poly.map((q) => pt(c.x + (q.x - c.x) * co - (q.y - c.y) * si, c.y + (q.x - c.x) * si + (q.y - c.y) * co));
}

/** Homothétie anisotrope d'un polygone autour de `c`. */
export function scaleAbout(poly: Poly, c: Vec, kx: number, ky: number): Poly {
  return poly.map((q) => pt(c.x + (q.x - c.x) * kx, c.y + (q.y - c.y) * ky));
}
