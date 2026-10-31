/** Vecteurs 3D purs. Repère du corps : x > 0 = côté GAUCHE du corps, y vers le BAS, z vers l'AVANT (le spectateur en vue de face). Unité = px de l'hôte. */
export interface P3 { readonly x: number; readonly y: number; readonly z: number }
export const p3 = (x: number, y: number, z: number): P3 => ({ x, y, z });
export const add3 = (a: P3, b: P3): P3 => p3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub3 = (a: P3, b: P3): P3 => p3(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul3 = (a: P3, k: number): P3 => p3(a.x * k, a.y * k, a.z * k);
export const dot3 = (a: P3, b: P3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: P3, b: P3): P3 => p3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len3 = (a: P3): number => Math.hypot(a.x, a.y, a.z);
export const norm3 = (a: P3): P3 => { const l = len3(a); return l < 1e-9 ? p3(0, 0, 1) : mul3(a, 1 / l); };
export const lerp3 = (a: P3, b: P3, t: number): P3 => p3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
/** Rotation d'un vecteur autour d'un axe unitaire (Rodrigues), angle en degrés. */
export function rotAxis(v: P3, axis: P3, deg: number): P3 {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), k = norm3(axis);
  return add3(add3(mul3(v, c), mul3(cross3(k, v), s)), mul3(k, dot3(k, v) * (1 - c)));
}
export const AX = { x: p3(1, 0, 0), y: p3(0, 1, 0), z: p3(0, 0, 1) } as const;
export const mirrorX = (a: P3): P3 => p3(-a.x, a.y, a.z);
export const finite3 = (a: P3): boolean => Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
