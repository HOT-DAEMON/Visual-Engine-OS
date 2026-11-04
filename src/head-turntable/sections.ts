import type { HeadTurnSpec, Row } from './types';
import { clamp } from './math';

/** Section interpolée : demi-largeur a, centre zc, demi-profondeur b (ellipse). Catmull-Rom sur la table de sections (a, zf, zb). */
export interface Section { readonly y: number; readonly a: number; readonly zc: number; readonly b: number; readonly zf: number; readonly zb: number }

const cr = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - 3 * p2 + p3 - p0) * t * t * t);

export function sectionAt(spec: HeadTurnSpec, y: number): Section {
  const r = spec.rows, n = r.length;
  const yy = clamp(y, r[0]!.y, r[n - 1]!.y);
  let i = 0;
  while (i < n - 2 && yy > r[i + 1]!.y) i++;
  const at = (k: number): Row => r[clamp(k, 0, n - 1)]!;
  const t = (yy - r[i]!.y) / (r[i + 1]!.y - r[i]!.y || 1);
  const a = Math.max(0, cr(at(i - 1).a, at(i).a, at(i + 1).a, at(i + 2).a, t));
  const zf = cr(at(i - 1).zf, at(i).zf, at(i + 1).zf, at(i + 2).zf, t);
  const zb = cr(at(i - 1).zb, at(i).zb, at(i + 1).zb, at(i + 2).zb, t);
  return { y: yy, a, zc: (zf + zb) / 2, b: Math.max(1e-4, (zf - zb) / 2), zf, zb };
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
  const s = sectionAt(spec, y);
  return { x: s.a * Math.sin(th), y, z: s.zc + s.b * Math.cos(th) };
}
