import type { V } from './types';

/** Primitives de forme du corps : vecteurs, splines fermées, fuseaux (muscles), membres à profil. Pur, déterministe, sans SVG hors `pathOf`. */
export const v = (x: number, y: number): V => ({ x, y });
export const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y);
export const sub = (a: V, b: V): V => v(a.x - b.x, a.y - b.y);
export const mul = (a: V, k: number): V => v(a.x * k, a.y * k);
export const len = (a: V): number => Math.hypot(a.x, a.y);
export const norm = (a: V): V => { const l = len(a) || 1; return v(a.x / l, a.y / l); };
export const lerpV = (a: V, b: V, t: number): V => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export const rotV = (a: V, deg: number): V => { const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return v(a.x * c - a.y * s, a.x * s + a.y * c); };
export const perp = (a: V): V => v(-a.y, a.x);
export const mirror = (p: readonly V[]): V[] => p.map((q) => v(-q.x, q.y)).reverse();
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Aire signée (shoelace). */
export function area(p: readonly V[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const u = p[i] as V, w = p[(i + 1) % p.length] as V; a += u.x * w.y - w.x * u.y; }
  return a / 2;
}
export function centroid(p: readonly V[]): V {
  let x = 0, y = 0;
  for (const q of p) { x += q.x; y += q.y; }
  return v(x / p.length, y / p.length);
}
export function inPoly(p: readonly V[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i] as V, b = p[j] as V;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function box(p: readonly V[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of p) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
  return { x0, y0, x1, y1 };
}

/** 2 décimales : 0,01 px d'erreur au plus (corps ≤ 1 000 px) — 25 % de SVG en moins qu'à 3 décimales, sans écart visible. */
const f3 = (n: number): string => String(Math.round(n * 100) / 100);
/** Spline de Catmull-Rom convertie en Béziers cubiques (compact : 1 courbe par sommet). `closed` ferme la boucle. */
export function pathOf(p: readonly V[], closed = true): string {
  const m = p.length;
  if (m < 2) return '';
  const at = (i: number): V => (closed ? (p[((i % m) + m) % m] as V) : (p[Math.min(m - 1, Math.max(0, i))] as V));
  let d = `M${f3((p[0] as V).x)} ${f3((p[0] as V).y)}`;
  const n = closed ? m : m - 1;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f3(p1.x + (p2.x - p0.x) / 6)} ${f3(p1.y + (p2.y - p0.y) / 6)} ${f3(p2.x - (p3.x - p1.x) / 6)} ${f3(p2.y - (p3.y - p1.y) / 6)} ${f3(p2.x)} ${f3(p2.y)}`;
  }
  return closed ? `${d}Z` : d;
}

/**
 * FUSEAU (muscle) le long d'un axe a→b : de t0 à t1, décalé de `off` (px, + = côté `n`), demi-largeur max `w`, ventre à la position `belly` (0..1).
 * Les extrémités sont des tendons fins (`tendon` px). Renvoie un polygone fermé de 2×(n+1) points.
 */
export function spindle(a: V, b: V, n: V, t0: number, t1: number, off: number, w: number, belly = 0.5, tendon = 0.04): V[] {
  const k = Math.log(0.5) / Math.log(Math.min(0.95, Math.max(0.05, belly)));
  const N = 6;
  const L: V[] = [], R: V[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, t = t0 + (t1 - t0) * s;
    const hw = Math.max(tendon * w, w * Math.sin(Math.PI * s ** k) ** 0.85);
    const c = add(add(a, mul(sub(b, a), t)), mul(n, off));
    L.push(add(c, mul(n, hw))); R.push(sub(c, mul(n, hw)));
  }
  return [...L, ...R.reverse()];
}

/** Station d'un profil de membre : t ∈ [0,1] le long de l'axe, demi-largeurs latérale / médiale (px). */
export interface Station { readonly t: number; readonly lat: number; readonly med: number }
const interp = (st: readonly Station[], t: number): { lat: number; med: number } => {
  let i = 0;
  while (i < st.length - 2 && t > (st[i + 1] as Station).t) i++;
  const A = st[i] as Station, B = st[i + 1] as Station;
  const u = Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t || 1))), s = u * u * (3 - 2 * u);
  return { lat: lerp(A.lat, B.lat, s), med: lerp(A.med, B.med, s) };
};
/** Contour d'un segment de membre : axe a→b, profil par stations, normale latérale `n`, bouts arrondis (`capA`, `capB` en fraction de la largeur). */
export function limbPoly(a: V, b: V, n: V, st: readonly Station[], capA = 0.5, capB = 0.5, N = 9): V[] {
  const u = norm(sub(b, a));
  const lat: V[] = [], med: V[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = interp(st, t), c = lerpV(a, b, t);
    lat.push(add(c, mul(n, w.lat))); med.push(sub(c, mul(n, w.med)));
  }
  const w0 = interp(st, 0), w1 = interp(st, 1);
  const tip = (c: V, w: { lat: number; med: number }, dir: V, k: number): V[] => (k <= 0 ? [] : [add(c, mul(dir, k * (w.lat + w.med) * 0.5))]);
  return [...tip(a, w0, mul(u, -1), capA), ...lat, ...tip(b, w1, u, capB), ...med.reverse()];
}
