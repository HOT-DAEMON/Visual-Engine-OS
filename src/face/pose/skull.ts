import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt } from '../outline';

/**
 * CRÂNE COMPLET : cranium ellipsoïdal (rx, ry, rz) + mâchoire (cône tronqué du coin de mâchoire au menton). Sert de support 3D à
 * tous les enfants : profondeur de surface z(x, y), silhouette projetée sous rotation. Repère de `tree.ts`, origine = pivot du cou.
 */
export interface Skull {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
  readonly topY: number;
  readonly jawY: number;
  readonly chinY: number;
  readonly jawHalf: number;
  readonly chinHalf: number;
  /** Profondeur de la surface du visage à (x, y) : ellipsoïde au-dessus de la mâchoire, cône dessous. */
  zAt(x: number, y: number): number;
  /** Demi-largeur de la silhouette projetée à l'ordonnée y pour une rotation `yawDeg`. */
  halfAt(y: number, yawDeg: number): number;
}

export function skullOf(lm: FaceLandmarks): Skull {
  const { H } = lm;
  const topY = -H / 2;
  const rx = halfWidthAt(lm.outline, lm.eyeY);
  const cy = (topY + lm.jawY) / 2;
  const ry = (lm.jawY - topY) / 2;
  const rz = 0.92 * rx;
  const jawHalf = halfWidthAt(lm.outline, lm.jawY);
  const chinHalf = Math.max(0.02 * lm.W, halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, lm.chinY - 0.02 * H)));
  const zAt = (x: number, y: number): number => {
    if (y <= lm.jawY) {
      const q = 1 - (x / rx) ** 2 - ((y - cy) / ry) ** 2;
      return rz * Math.sqrt(Math.max(0, q));
    }
    const u = Math.min(1, (y - lm.jawY) / Math.max(1e-6, lm.chinY - lm.jawY));
    const w = jawHalf + (chinHalf - jawHalf) * u;
    const zj = rz * 0.62 * (1 - 0.35 * u);
    return zj * Math.sqrt(Math.max(0, 1 - (x / Math.max(w, 1e-6)) ** 2));
  };
  const halfAt = (y: number, yawDeg: number): number => {
    const a = (yawDeg * Math.PI) / 180;
    const hx = halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(topY, y)));
    const hz = y <= lm.jawY ? rz * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) : zAt(0, y);
    return Math.hypot(hx * Math.cos(a), hz * Math.sin(a));
  };
  return { cx: 0, cy, rx, ry, rz, topY, jawY: lm.jawY, chinY: lm.chinY, jawHalf, chinHalf, zAt, halfAt };
}
