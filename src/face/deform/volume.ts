import type { Vec } from '../../geometry/eye/primitives';
import { polyArea, type Poly } from '../poly';

/**
 * MAINTIEN DU VOLUME (H) en 2D : une région de chair déplacée par un champ de tissu change d'aire ; on la ramène à son aire d'origine par une
 * homothétie centrée sur son centroïde. L'aire est la grandeur conservée (le « volume » d'un patch de peau vu de face). Le rapport avant correction
 * est exposé (`stretch`) : c'est la mesure de l'étirement (> 1) ou de la compression (< 1) subis.
 */
export function centroid(p: Poly): Vec {
  let x = 0;
  let y = 0;
  for (const q of p) {
    x += q.x;
    y += q.y;
  }
  return { x: x / p.length, y: y / p.length };
}

export interface Preserved {
  readonly poly: Poly;
  /** Aire déformée / aire d'origine, AVANT correction (1 = pas d'étirement). */
  readonly stretch: number;
}

export function preserveArea(original: Poly, deformed: Poly): Preserved {
  const a0 = Math.abs(polyArea(original));
  const a1 = Math.abs(polyArea(deformed));
  // Aire nulle (dégénéré) : rien à conserver.
  if (a0 < 1e-9 || a1 < 1e-9) return { poly: deformed, stretch: 1 };
  const k = Math.sqrt(a0 / a1);
  const c = centroid(deformed);
  return { poly: deformed.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k })), stretch: a1 / a0 };
}
