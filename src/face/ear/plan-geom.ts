import type { Vec } from '../../geometry/eye/primitives';
import { catmullRom } from '../curve';
import { inPoly, type Poly } from '../poly';

/** Géométrie 2D du PLAN de l'oreille : rubans, décalages intérieurs, blobs. Pure, sans SVG. */
export const pt = (x: number, y: number): Vec => ({ x, y });
export const lerp2 = (a: Vec, b: Vec, t: number): Vec => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Normale unitaire gauche (x, y) → (−y, x) de la tangente en i d'une polyligne (ouverte ou fermée). */
function normalAt(p: readonly Vec[], i: number, closed: boolean): Vec {
  const n = p.length;
  const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Vec;
  const b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Vec;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return pt(-(b.y - a.y) / l, (b.x - a.x) / l);
}

/** Ruban autour d'une ligne médiane ouverte : demi-largeur `w[i]` de part et d'autre. Polygone fermé. */
export function ribbon(center: readonly Vec[], w: readonly number[]): Poly {
  const L: Vec[] = [];
  const R: Vec[] = [];
  center.forEach((c, i) => {
    const n = normalAt(center, i, false);
    const k = w[Math.min(i, w.length - 1)] as number;
    L.push(pt(c.x + n.x * k, c.y + n.y * k));
    R.push(pt(c.x - n.x * k, c.y - n.y * k));
  });
  return [...L, ...R.reverse()];
}

/** Ligne médiane lisse (Catmull-Rom ouverte) par des points de contrôle. */
export const path = (ctrl: readonly Vec[], n = 8): Poly => catmullRom(ctrl, false, n);
/** Blob fermé et lisse par des points de contrôle. */
export const blobOf = (ctrl: readonly Vec[], n = 6): Poly => catmullRom(ctrl, true, n);
/** Ellipse (centre, demi-axes, rotation en degrés). */
export function ellipse(c: Vec, rx: number, ry: number, rotDeg = 0, n = 20): Poly {
  const t = (rotDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    return pt(c.x + x * Math.cos(t) - y * Math.sin(t), c.y + x * Math.sin(t) + y * Math.cos(t));
  });
}

/** Signe qui oriente `normalAt` VERS L'INTÉRIEUR du contour fermé : testé au sommet le plus à droite (toujours convexe). */
function inwardSign(poly: Poly): 1 | -1 {
  let k = 0;
  poly.forEach((q, i) => { if (q.x > (poly[k] as Vec).x) k = i; });
  const n = normalAt(poly, k, true);
  return n.x < 0 ? 1 : -1;
}

/** Contour décalé vers l'intérieur de `w[i]` aux sommets `idx` (indices du contour fermé, éventuellement bouclés). */
export function inset(poly: Poly, idx: readonly number[], w: readonly number[]): Poly {
  const s = inwardSign(poly);
  return idx.map((i, j) => {
    const q = poly[((i % poly.length) + poly.length) % poly.length] as Vec;
    const n = normalAt(poly, ((i % poly.length) + poly.length) % poly.length, true);
    const k = (w[Math.min(j, w.length - 1)] as number) * s;
    return pt(q.x + n.x * k, q.y + n.y * k);
  });
}

/** Bande entre le contour (décalé de `a`) et le contour décalé de `b` (b > a), sur les indices `idx`. */
export function band(poly: Poly, idx: readonly number[], a: readonly number[], b: readonly number[]): Poly {
  return [...inset(poly, idx, a), ...inset(poly, idx, b).reverse()];
}

/** Indices consécutifs de `from` à `to` (exclu) sur un contour fermé de `n` sommets. */
export const span = (n: number, from: number, to: number): number[] => {
  const len = ((to - from) % n + n) % n || n;
  return Array.from({ length: len }, (_, k) => (from + k) % n);
};

/** Part d'une polyligne comprise dans le polygone (pour vérifier qu'une structure reste dans le pavillon). */
export const insideShare = (poly: Poly, outline: Poly): number => poly.filter((q) => inPoly(outline, q.x, q.y)).length / Math.max(1, poly.length);

/** Boîte englobante. */
export function box(p: readonly Vec[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = p.map((q) => q.x);
  const ys = p.map((q) => q.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
