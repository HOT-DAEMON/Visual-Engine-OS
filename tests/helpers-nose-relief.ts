import { headGrid, headRelief } from '../src/relief';
import { inPoly } from '../src/face/poly';
import type { Vec } from '../src/geometry/eye/primitives';
import { bundle } from './helpers-structure';

/** Champ de profondeur de la tête (grille 1,5 px/unité) pour un patch de paramètres, plus les régions du nez qui le produisent. */
export function reliefOf(patch: Record<string, unknown>) {
  const b = bundle(patch), g = headGrid(b.lm, 1.5), f = headRelief(b.p, b.lm, b.nose, { grid: g, zc: 0 });
  return { ...b, g, f };
}
export type Relief = ReturnType<typeof reliefOf>;

/** Distance d'un point à une polyligne ouverte. */
export function distTo(pts: readonly Vec[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, c = pts[i + 1]!, dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy, t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return best;
}

/** Différence de profondeur |A − B| par pixel (px), sur les pixels définis dans les deux champs. */
export function diffField(A: Relief, B: Relief): { x: number; y: number; d: number }[] {
  const out: { x: number; y: number; d: number }[] = [];
  for (let j = 0; j < A.g.h; j++) for (let i = 0; i < A.g.w; i++) {
    const k = j * A.g.w + i, a = A.f.depth[k]!, b = B.f.depth[k]!;
    if (a === -Infinity || b === -Infinity) continue;
    const d = Math.abs(a - b);
    if (d > 1e-6) out.push({ x: A.g.x0 + (i + 0.5) / A.g.ppu, y: A.g.y0 + (j + 0.5) / A.g.ppu, d });
  }
  return out;
}
export const mass = (px: { d: number }[]): number => px.reduce((s, q) => s + q.d, 0);
export const inPolys = (polys: readonly Vec[][], x: number, y: number): boolean => polys.some((p) => inPoly(p, x, y));
