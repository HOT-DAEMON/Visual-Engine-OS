import type { NeckAnchor } from '../types';
import { vol } from './mk';
import type { Trunk } from './trunk';
import type { Volume } from './types';
import { add3, cross3, dot3, mul3, norm3, p3, sub3, type P3 } from './vec3';

/** COU 3D : ellipse par hauteur, portée par la colonne cervicale (lordose). Le cou s'évase vers le tronc ; les muscles du cou lisent `point` comme ceux du tronc lisent `trunk.point`. */
export interface Neck { readonly point: (y: number, psi: number, lift?: number) => { p: P3; n: P3 }; readonly envelope: Volume; readonly top: number }
export function makeNeck(tr: Trunk, a: NeckAnchor, male: number): Neck {
  const bh = a.baseHalf, top = a.chinY - 0.12 * a.h, span = a.baseY - top;
  const sm = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
  const X = (y: number): number => bh * (0.8 + 0.2 * sm((y - top) / span));
  const zc = (y: number): number => tr.spine.z(y) + 0.28 * bh;
  const raw = (y: number, psi: number): P3 => p3(X(y) * Math.sin(psi), y, zc(y) + 0.9 * X(y) * Math.cos(psi));
  const point = (y: number, psi: number, lift = 0): { p: P3; n: P3 } => {
    const e = 0.004 * a.h, P = raw(y, psi);
    let n = norm3(cross3(sub3(raw(y + e, psi), raw(y - e, psi)), sub3(raw(y, psi + 0.01), raw(y, psi - 0.01))));
    if (dot3(n, sub3(P, p3(0, y, zc(y)))) < 0) n = mul3(n, -1);
    return { p: add3(P, mul3(n, lift)), n };
  };
  const ys = [top, top + 0.35 * span, top + 0.7 * span, a.baseY + 0.04 * a.h];
  const envelope = vol({ id: 'neck', name: 'cou (colonne cervicale)', group: 'neck', kind: 'skin', level: 0, layer: 0 }, ys.map((y) => ({ c: p3(0, y, zc(y)), a: X(y), b: 0.9 * X(y), hint: p3(0, 0, 1) })));
  void male;
  return { point, envelope, top };
}
