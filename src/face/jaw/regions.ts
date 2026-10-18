import type { Vec } from '../../geometry/eye/primitives';
import { rightSamples } from '../outline';
import type { FaceLandmarks } from '../landmarks';
import type { Poly } from '../poly';

/**
 * Polygones du menton et de la tête (géométrie pure) : la silhouette de la TÊTE entière (contour fermé), celle du MENTON (du sillon
 * mentolabial au bas, fermée par une corde) et la ligne de MÂCHOIRE (contour bas, du coin de mâchoire gauche au droit). Servent aux
 * ombres de contact (la mâchoire projette sur le cou), aux lumières de contour du menton et à la vérification.
 */
export function headPoly(lm: FaceLandmarks): Poly {
  const r = rightSamples(lm.outline, 24);
  return [...r, ...[...r].reverse().map((q): Vec => ({ x: -q.x, y: q.y }))];
}

/** Menton : points du contour dont l'ordonnée est sous le sillon mentolabial, refermés par la corde du sillon. */
export function chinPoly(lm: FaceLandmarks): Poly {
  const r = rightSamples(lm.outline, 24).filter((q) => q.y >= lm.chin.sulcusY);
  if (r.length === 0) return [];
  const top = r[0] as Vec;
  const right = [{ x: top.x, y: lm.chin.sulcusY }, ...r];
  return [...right, ...[...right].reverse().map((q): Vec => ({ x: -q.x, y: q.y }))];
}

/** Ligne de mâchoire : du bas de l'oreille gauche au coin de mâchoire, au menton, puis symétriquement (polyligne). */
export function jawline(lm: FaceLandmarks): Vec[] {
  const r = rightSamples(lm.outline, 24).filter((q) => q.y >= lm.jaw.gonion.y - 0.05 * lm.H);
  return [...[...r].reverse().map((q): Vec => ({ x: -q.x, y: q.y })), ...r];
}
