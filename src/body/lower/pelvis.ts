import { mk, pair } from '../atom';
import { lerp, v } from '../shape';
import type { Atom, V } from '../types';
import type { LegFrame } from './frame';

/** Demi-largeur du bassin à l'ordonnée y : x.hip au bord de la taille basse, léger renflement trochantérien, puis passage de relais aux cuisses. */
export const pelvisHalf = (lf: LegFrame, y: number): number => {
  const { crop, crotch } = lf.y, hip = lf.body.x.hip, t = Math.min(1, Math.max(0, (y - crop) / (crotch - crop || 1))), s = t * t * (3 - 2 * t);
  return hip * (1 + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.04 * s);
};

/**
 * BASSIN (vue de face) : enveloppe qui relie le tronc (parent `torso.shell`) aux deux cuisses, ligne des hanches, fessiers (cachés de face),
 * moyen fessier, grand trochanter, triangle fémoral, symphyse et os du bassin. AUCUN organe génital n'est modélisé : la figure s'arrête
 * à un contour neutre à la fourche (choix documenté dans `docs/BODY-LOWER.md`).
 */
export function pelvisAtoms(lf: LegFrame): Atom[] {
  const { crop, crotch } = lf.y, h = lf.body.h, d = crotch - crop;
  const P = (u: number, y: number): V => v(u * pelvisHalf(lf, y), y);
  const y0 = crop - 0.02 * h, ys = [y0, lerp(crop, crotch, 0.3), lerp(crop, crotch, 0.62), crotch - 0.02 * h];
  const R = ys.map((y) => v(pelvisHalf(lf, y), y));
  const poly = [...R, v(0.05 * h, crotch + 0.012 * h), v(0, crotch + 0.004 * h), v(-0.05 * h, crotch + 0.012 * h), ...[...R].reverse().map((q) => v(-q.x, q.y))];
  const out: Atom[] = [mk('pelvis.shell', 'skin', 'pelvis', 'torso.shell', 0, poly, { z: 1 })];
  out.push(...pair('gluteus-medius', 'muscle', 'pelvis', 'pelvis.shell', 2, () => [P(0.7, crop + 0.04 * d), P(0.98, crop + 0.06 * d), P(1.0, crop + 0.36 * d), P(0.86, crop + 0.3 * d)], { tone: -0.1, sidedParent: false }));
  out.push(...pair('gluteus-maximus', 'muscle', 'pelvis', 'pelvis.shell', 2, () => [P(0.3, crop + 0.3 * d), P(0.98, crop + 0.3 * d), P(0.92, crotch - 0.02 * h), P(0.3, crotch - 0.03 * h)], { view: 'occluded', tone: -0.2, sidedParent: false }));
  out.push(...pair('pelvis.greater-trochanter', 'landmark', 'pelvis', 'pelvis.shell', 3, () => [P(0.94, crop + 0.42 * d), P(1.0, crop + 0.45 * d), P(0.96, crop + 0.58 * d), P(0.9, crop + 0.52 * d)], { sidedParent: false }));
  out.push(...pair('pelvis.femoral-triangle', 'fat', 'pelvis', 'pelvis.shell', 3, () => [P(0.25, crop + 0.55 * d), P(0.62, crop + 0.5 * d), P(0.52, crotch - 0.01 * h)], { tone: -0.2, sidedParent: false }));
  out.push(...pair('pelvis.iliac-wing', 'bone', 'pelvis', 'pelvis.shell', 2, () => [P(0.45, crop - 0.015 * h), P(0.96, crop + 0.01 * d), P(0.8, crop + 0.3 * d), P(0.4, crop + 0.28 * d)], { view: 'occluded', sidedParent: false }));
  out.push(...pair('pelvis.pubic-ramus', 'bone', 'pelvis', 'pelvis.shell', 2, () => [P(0.08, crotch - 0.04 * h), P(0.45, crop + 0.78 * d), P(0.38, crotch - 0.005 * h), P(0.06, crotch - 0.01 * h)], { view: 'occluded', sidedParent: false }));
  out.push(mk('pelvis.symphysis', 'bone', 'pelvis', 'pelvis.shell', 3, [v(-0.015 * h, crotch - 0.045 * h), v(0.015 * h, crotch - 0.045 * h), v(0.012 * h, crotch - 0.01 * h), v(-0.012 * h, crotch - 0.01 * h)], { view: 'occluded' }));
  out.push(mk('pelvis.sacrum', 'bone', 'pelvis', 'pelvis.shell', 2, [P(-0.2, crop + 0.05 * d), P(0.2, crop + 0.05 * d), P(0.1, crop + 0.6 * d), P(-0.1, crop + 0.6 * d)], { view: 'occluded' }));
  return out;
}
