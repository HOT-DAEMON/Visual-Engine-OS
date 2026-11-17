import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';

/** Insère des points sur les arêtes plus longues que `maxLen` : la projection n'est pas affine, une arête droite entre deux sommets éloignés serait fausse une fois projetée. */
export function densify(poly: Poly, maxLen: number): Poly {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec, b = poly[(i + 1) % poly.length] as Vec, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxLen));
    for (let j = 0; j < n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
  }
  return out;
}
