import type { HeadTurnSpec, Row } from './types';
import { clamp } from './math';

/**
 * Section interpolée : demi-largeur a, avant zf, arrière zb, centre zc, demi-profondeur b (ellipse équivalente, pour les consommateurs qui en supposent une),
 * plus la FORME : point le plus large `zw` et exposants `pf` / `qf` de la moitié avant (voir `Row`). La moitié arrière est une demi-ellipse de profondeur zw − zb, ou une demi-superellipse (pb, qb) pour un crâne dont l'occiput n'est pas elliptique.
 */
export interface Section { readonly y: number; readonly a: number; readonly zc: number; readonly b: number; readonly zf: number; readonly zb: number; readonly zw: number; readonly pf: number; readonly qf: number; readonly pb?: number; readonly qb?: number }

/** Tangentes par différences centrées en y, à pas NON uniforme : calculées UNE fois par table (avant : une fermeture et deux divisions par évaluation, soit des millions par rendu). */
function tangents(ys: readonly number[], v: readonly number[]): number[] {
  const n = ys.length;
  return v.map((_, k) => { const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1); return (v[k1]! - v[k0]!) / (ys[k1]! - ys[k0]! || 1); });
}

/** Hermite cubique C¹ à pas NON uniforme (tangentes `tn` par différences centrées en y) : identique à Catmull-Rom quand le pas est régulier, sans le défaut de tangente aux changements de pas. */
function hermite(ys: readonly number[], v: readonly number[], tn: readonly number[], i: number, yy: number): number {
  const d = ys[i + 1]! - ys[i]!, t = (yy - ys[i]!) / (d || 1), t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v[i]! + (t3 - 2 * t2 + t) * d * tn[i]! + (-2 * t3 + 3 * t2) * v[i + 1]! + (t3 - t2) * d * tn[i + 1]!;
}

type Col = { readonly v: number[]; readonly t: number[] };
interface Table { readonly ys: number[]; readonly a: Col; readonly zf: Col; readonly zb: Col; readonly zw: Col; readonly pf: Col; readonly qf: Col; readonly pb: Col; readonly qb: Col }
const CACHE = new WeakMap<readonly Row[], Table>();
function table(r: readonly Row[]): Table {
  let t = CACHE.get(r);
  if (!t) {
    const ys = r.map((q) => q.y), col = (f: (q: Row) => number): Col => { const v = r.map(f); return { v, t: tangents(ys, v) }; };
    CACHE.set(r, (t = { ys, a: col((q) => q.a), zf: col((q) => q.zf), zb: col((q) => q.zb), zw: col((q) => q.zw ?? (q.zf + q.zb) / 2), pf: col((q) => q.pf ?? 2), qf: col((q) => q.qf ?? 2), pb: col((q) => q.pb ?? 2), qb: col((q) => q.qb ?? 2) }));
  }
  return t;
}

export function sectionAt(spec: HeadTurnSpec, y: number): Section {
  const r = spec.rows, n = r.length, T = table(r);
  const yy = clamp(y, r[0]!.y, r[n - 1]!.y);
  let i = 0;
  while (i < n - 2 && yy > r[i + 1]!.y) i++;
  const h = (c: Col): number => hermite(T.ys, c.v, c.t, i, yy);
  const a = Math.max(0, h(T.a));
  const zf = h(T.zf), zb = Math.min(h(T.zb), zf - 2e-4);
  const zw = clamp(h(T.zw), zb + 1e-4, zf - 1e-4);
  return { y: yy, a, zc: (zf + zb) / 2, b: Math.max(1e-4, (zf - zb) / 2), zf, zb, zw, pf: clamp(h(T.pf), 0.7, 4), qf: clamp(h(T.qf), 0.7, 4), pb: clamp(h(T.pb), 0.7, 4), qb: clamp(h(T.qb), 0.7, 4) };
}

/** Point (x, z) du contour de la section à l'angle θ (0 = face, +π/2 = côté +x, π = arrière). Moitié avant : superellipse (pf, qf) ; moitié arrière : superellipse (pb, qb), demi-ellipse par défaut. */
export function sectionPoint(s: Section, th: number): { x: number; z: number } {
  const sn = Math.sin(th), cs = Math.cos(th), sx = sn < 0 ? -1 : 1;
  if (cs >= 0) return { x: sx * s.a * Math.abs(sn) ** (2 / s.qf), z: s.zw + (s.zf - s.zw) * cs ** (2 / s.pf) };
  return { x: sx * s.a * Math.abs(sn) ** (2 / (s.qb ?? 2)), z: s.zw - (s.zw - s.zb) * (-cs) ** (2 / (s.pb ?? 2)) };
}

/** Hauteur z de la surface (avant ou arrière) à l'abscisse x ; 0 d'épaisseur au-delà de la demi-largeur. Généralise `zc ± b·√(1 − (x/a)²)`. */
export function surfaceZ(s: Section, x: number, front = true): number {
  const u = Math.min(1, Math.abs(x) / Math.max(1e-6, s.a));
  return front ? s.zw + (s.zf - s.zw) * Math.max(0, 1 - u ** s.qf) ** (1 / s.pf) : s.zw - (s.zw - s.zb) * Math.max(0, 1 - u ** (s.qb ?? 2)) ** (1 / (s.pb ?? 2));
}

/** Demi-largeur de la section à la profondeur z (inverse de `surfaceZ`) ; 0 hors de [zb, zf]. */
export function halfWidthAtZ(s: Section, z: number): number {
  if (z > s.zf || z < s.zb) return 0;
  if (z >= s.zw) return s.a * Math.max(0, 1 - ((z - s.zw) / Math.max(1e-6, s.zf - s.zw)) ** s.pf) ** (1 / s.qf);
  return s.a * Math.max(0, 1 - ((s.zw - z) / Math.max(1e-6, s.zw - s.zb)) ** (s.pb ?? 2)) ** (1 / (s.qb ?? 2));
}

/** Pentes de la cubique MONOTONE (Fritsch-Carlson) d'une lisière : une fois par liste de nœuds (avant : recalculées, avec deux tableaux, à CHAQUE pixel peint). */
const SLOPES = new WeakMap<readonly (readonly [number, number])[], number[]>();
function slopes(k: readonly (readonly [number, number])[]): number[] {
  let m = SLOPES.get(k);
  if (!m) {
    const n = k.length, d = k.slice(0, -1).map((p, i) => (k[i + 1]![1] - p[1]) / (k[i + 1]![0] - p[0] || 1));
    SLOPES.set(k, (m = k.map((_, i) => (i === 0 ? d[0]! : i === n - 1 ? d[n - 2]! : d[i - 1]! * d[i]! <= 0 ? 0 : (2 * d[i - 1]! * d[i]!) / (d[i - 1]! + d[i]!)))));
  }
  return m;
}

/** Hauteur de la lisière des cheveux à l'azimut `azDeg` (0 = face), cubique de Hermite MONOTONE (Fritsch-Carlson) entre les nœuds : pas de paliers ni de rebonds ; symétrique gauche/droite. */
export function hairlineY(spec: HeadTurnSpec, azDeg: number): number {
  const k = spec.hairline.knots, n = k.length, az = clamp(Math.abs(azDeg), k[0]![0], k[n - 1]![0]), m = slopes(k);
  let i = 0; while (i < n - 2 && az > k[i + 1]![0]) i++;
  const [x0, y0] = k[i]!, [x1, y1] = k[i + 1]!, h = x1 - x0, t = (az - x0) / (h || 1), t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1]!;
}

/** Point de la surface de la tête (sans bosses) à la hauteur y et à l'azimut θ (radians ; 0 = face, +π/2 = côté +x). */
export function headPoint(spec: HeadTurnSpec, y: number, th: number): { x: number; y: number; z: number } {
  const s = sectionAt(spec, y), q = sectionPoint(s, th);
  return { x: q.x, y, z: q.z };
}
