import type { HeadTurnSpec, Row } from './types';
import { clamp } from './math';

/**
 * Section interpolée : demi-largeur a, avant zf, arrière zb, centre zc, demi-profondeur b (ellipse équivalente, pour les consommateurs qui en supposent une),
 * plus la FORME : point le plus large `zw` et exposants `pf` / `qf` de la moitié avant (voir `Row`). La moitié arrière reste une demi-ellipse de profondeur zw − zb.
 */
export interface Section { readonly y: number; readonly a: number; readonly zc: number; readonly b: number; readonly zf: number; readonly zb: number; readonly zw: number; readonly pf: number; readonly qf: number }

/** Hermite cubique C¹ à pas NON uniforme (tangentes par différences centrées en y) : identique à Catmull-Rom quand le pas est régulier, sans le défaut de tangente aux changements de pas. */
function hermite(ys: readonly number[], v: readonly number[], i: number, yy: number): number {
  const n = ys.length, tan = (k: number): number => { const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1); return (v[k1]! - v[k0]!) / (ys[k1]! - ys[k0]! || 1); };
  const d = ys[i + 1]! - ys[i]!, t = (yy - ys[i]!) / (d || 1), t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v[i]! + (t3 - 2 * t2 + t) * d * tan(i) + (-2 * t3 + 3 * t2) * v[i + 1]! + (t3 - t2) * d * tan(i + 1);
}

const CACHE = new WeakMap<readonly Row[], { ys: number[]; a: number[]; zf: number[]; zb: number[]; zw: number[]; pf: number[]; qf: number[] }>();
function table(r: readonly Row[]): { ys: number[]; a: number[]; zf: number[]; zb: number[]; zw: number[]; pf: number[]; qf: number[] } {
  let t = CACHE.get(r);
  if (!t) CACHE.set(r, (t = { ys: r.map((q) => q.y), a: r.map((q) => q.a), zf: r.map((q) => q.zf), zb: r.map((q) => q.zb), zw: r.map((q) => q.zw ?? (q.zf + q.zb) / 2), pf: r.map((q) => q.pf ?? 2), qf: r.map((q) => q.qf ?? 2) }));
  return t;
}

export function sectionAt(spec: HeadTurnSpec, y: number): Section {
  const r = spec.rows, n = r.length, T = table(r);
  const yy = clamp(y, r[0]!.y, r[n - 1]!.y);
  let i = 0;
  while (i < n - 2 && yy > r[i + 1]!.y) i++;
  const a = Math.max(0, hermite(T.ys, T.a, i, yy));
  const zf = hermite(T.ys, T.zf, i, yy), zb = Math.min(hermite(T.ys, T.zb, i, yy), zf - 2e-4);
  const zw = clamp(hermite(T.ys, T.zw, i, yy), zb + 1e-4, zf - 1e-4);
  return { y: yy, a, zc: (zf + zb) / 2, b: Math.max(1e-4, (zf - zb) / 2), zf, zb, zw, pf: clamp(hermite(T.ys, T.pf, i, yy), 0.7, 4), qf: clamp(hermite(T.ys, T.qf, i, yy), 0.7, 4) };
}

/** Point (x, z) du contour de la section à l'angle θ (0 = face, +π/2 = côté +x, π = arrière). Moitié avant : superellipse (pf, qf) ; moitié arrière : demi-ellipse. */
export function sectionPoint(s: Section, th: number): { x: number; z: number } {
  const sn = Math.sin(th), cs = Math.cos(th), sx = sn < 0 ? -1 : 1;
  if (cs >= 0) return { x: sx * s.a * Math.abs(sn) ** (2 / s.qf), z: s.zw + (s.zf - s.zw) * cs ** (2 / s.pf) };
  return { x: s.a * sn, z: s.zw - (s.zw - s.zb) * -cs };
}

/** Hauteur z de la surface (avant ou arrière) à l'abscisse x ; 0 d'épaisseur au-delà de la demi-largeur. Généralise `zc ± b·√(1 − (x/a)²)`. */
export function surfaceZ(s: Section, x: number, front = true): number {
  const u = Math.min(1, Math.abs(x) / Math.max(1e-6, s.a));
  return front ? s.zw + (s.zf - s.zw) * Math.max(0, 1 - u ** s.qf) ** (1 / s.pf) : s.zw - (s.zw - s.zb) * Math.sqrt(Math.max(0, 1 - u * u));
}

/** Demi-largeur de la section à la profondeur z (inverse de `surfaceZ`) ; 0 hors de [zb, zf]. */
export function halfWidthAtZ(s: Section, z: number): number {
  if (z > s.zf || z < s.zb) return 0;
  if (z >= s.zw) return s.a * Math.max(0, 1 - ((z - s.zw) / Math.max(1e-6, s.zf - s.zw)) ** s.pf) ** (1 / s.qf);
  return s.a * Math.sqrt(Math.max(0, 1 - ((s.zw - z) / Math.max(1e-6, s.zw - s.zb)) ** 2));
}

/** Hauteur de la lisière des cheveux à l'azimut `azDeg` (0 = face), cubique de Hermite MONOTONE (Fritsch-Carlson) entre les nœuds : pas de paliers ni de rebonds ; symétrique gauche/droite. */
export function hairlineY(spec: HeadTurnSpec, azDeg: number): number {
  const k = spec.hairline.knots, n = k.length, az = clamp(Math.abs(azDeg), k[0]![0], k[n - 1]![0]);
  const d = k.slice(0, -1).map((p, i) => (k[i + 1]![1] - p[1]) / (k[i + 1]![0] - p[0] || 1));
  const m = k.map((_, i) => (i === 0 ? d[0]! : i === n - 1 ? d[n - 2]! : d[i - 1]! * d[i]! <= 0 ? 0 : (2 * d[i - 1]! * d[i]!) / (d[i - 1]! + d[i]!)));
  let i = 0; while (i < n - 2 && az > k[i + 1]![0]) i++;
  const [x0, y0] = k[i]!, [x1, y1] = k[i + 1]!, h = x1 - x0, t = (az - x0) / (h || 1), t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1]!;
}

/** Point de la surface de la tête (sans bosses) à la hauteur y et à l'azimut θ (radians ; 0 = face, +π/2 = côté +x). */
export function headPoint(spec: HeadTurnSpec, y: number, th: number): { x: number; y: number; z: number } {
  const s = sectionAt(spec, y), q = sectionPoint(s, th);
  return { x: q.x, y, z: q.z };
}
