import { simBrowY } from '../face/hair/sim/drape';
import type { FaceLandmarks } from '../face';
import type { HairGeometry } from '../face/hair';
import { halfWidthAt } from '../face/outline';
import { polyArea } from '../face/poly';
import { check, type Check } from './types';

/**
 * COHÉRENCE GÉOMÉTRIQUE de la chevelure : tout est fini, les polygones ne sont pas dégénérés, l'enveloppe reste dans
 * une boîte raisonnable autour du visage, la ligne d'implantation reste au-dessus des sourcils, et aucune mèche AVANT
 * (hors mèches de joue et mèches qui passent devant, qui ont leur propre règle) n'entre dans la zone centrale du visage.
 */
export function checkGeometry(geo: HairGeometry, lm: FaceLandmarks): Check[] {
  const { W, H } = lm;
  const polys = geo.locks.map((l) => l.poly);
  const pts = polys.flat();
  const out: Check[] = [];
  out.push(check('geometry', 'finite', '==', pts.filter((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y)).length, 0, 'sommets non finis'));
  out.push(check('geometry', 'min-vertices', '==', polys.filter((p) => p.length < 3).length, 0, 'polygones de moins de 3 sommets'));
  // Surface minimale : un poil très fin a une aire minuscule mais jamais nulle.
  out.push(check('geometry', 'non-degenerate', '==', geo.locks.filter((l) => (l.rank === 'mass' || l.rank === 'main') && l.poly.length >= 3 && Math.abs(polyArea(l.poly)) < 1e-4).length, 0, 'mèches épaisses d\'aire nulle (les poils fins écrasés par le garde-fou sont tolérés)'));
  const out2 = pts.filter((q) => Math.abs(q.x) > 1.8 * W || q.y < -1.5 * H || q.y > 1.6 * H).length;
  out.push(check('geometry', 'bounds', '==', out2, 0, "sommets hors de l'enveloppe admissible (±1,8 W, −1,5 H … 1,6 H)"));
  const hlLow = Math.max(...geo.hairline.map((q) => q.y));
  out.push(check('geometry', 'hairline-above-brow', '<=', hlLow, lm.browLimitY - 0.03 * H, 'la ligne d\'implantation descend sous la limite des sourcils'));
  // Zone centrale du visage : sous la limite des sourcils, au-delà de 0,09 W du contour, au-dessus du menton.
  const half = (y: number): number => halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-H / 2, y)));
  const intruders = geo.locks.filter((l) => l.layer === 'front' && l.kind !== 'cheek').flatMap((l) => l.poly).filter((q) => q.y > (geo.locks.some((l) => l.sim) ? simBrowY(lm) : lm.browLimitY - 0.008 * H) + 1e-6 && q.y < lm.chinY && Math.abs(q.x) < half(q.y) - 0.09 * W).length;
  // Cheveux à masses de région : la règle large est remplacée par la protection des SEULS yeux, sourcils, nez, bouche (`hair-zones.ts`).
  const zoned = geo.locks.some((l) => l.zone !== undefined);
  if (!zoned) out.push(check('geometry', 'face-interior-clear', '==', intruders, 0, 'sommets de mèches avant dans la zone centrale du visage'));
  return out;
}
