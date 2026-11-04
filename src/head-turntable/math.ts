import type { V3, View } from './types';

/** Mathématiques de vue. Lacet a (autour de la verticale de la tête), puis tangage b de caméra :
 *    x₁ = x cos a − z sin a ;  z₁ = x sin a + z cos a ;  y₂ = y cos b − z₁ sin b ;  z₂ = y sin b + z₁ cos b   (z₂ grand = proche).
 *  Image = (x₁, y₂). Les mêmes formules sont ajustées sur la planche de référence (`scripts/head-turntable/measure-rotation.py`). */
export const rad = (d: number): number => (d * Math.PI) / 180;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

export interface Cam { readonly x: number; readonly y: number; readonly z: number }

/** Point de la tête → repère caméra (x₁, y₂, z₂). */
export function toCam(p: V3, v: View): Cam {
  const a = rad(v.yaw), b = rad(v.pitch), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const x1 = p.x * ca - p.z * sa, z1 = p.x * sa + p.z * ca;
  return { x: x1, y: p.y * cb - z1 * sb, z: p.y * sb + z1 * cb };
}

/** Direction (vecteur, sans translation) tête → caméra. */
export const dirToCam = toCam;

/** Direction caméra → tête (rotation inverse) : sert à exprimer la lumière de la caméra dans le repère de la tête. */
export function camToHead(c: Cam, v: View): V3 {
  const a = rad(v.yaw), b = rad(v.pitch), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const y1 = c.y * cb + c.z * sb, z1 = -c.y * sb + c.z * cb;
  return { x: c.x * ca + z1 * sa, y: y1, z: -c.x * sa + z1 * ca };
}

export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const norm = (a: V3): V3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
