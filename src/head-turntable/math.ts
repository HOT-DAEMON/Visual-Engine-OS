import type { RollRig, V3, View } from './types';

/** Mathématiques de vue. Lacet a (autour de la verticale de la tête), puis tangage b de caméra :
 *    x₁ = x cos a − z sin a ;  z₁ = x sin a + z cos a ;  y₂ = y cos b − z₁ sin b ;  z₂ = y sin b + z₁ cos b   (z₂ grand = proche).
 *  Image = (x₁, y₂). Les mêmes formules sont ajustées sur la planche de référence (`scripts/head-turntable/measure-rotation.py`). */
export const rad = (d: number): number => (d * Math.PI) / 180;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

export interface Cam { readonly x: number; readonly y: number; readonly z: number }

/** Pièce de la chaîne du roulis : la tête (crâne, oreilles, bosses) suit le roulis total ; le cou se plie, de 0 à sa base à `bend` à son sommet. */
export type Limb = 'head' | 'neck';
const rot = (p: V3, a: number, c: V3): V3 => { const ca = Math.cos(a), sa = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y; return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca, z: p.z }; };
/** Poids de la flexion du cou à la hauteur y : 1 au sommet (T), 0 à la base (B), C¹ entre les deux. */
const bendW = (y: number, g: RollRig): number => smooth((g.B.y - y) / (g.B.y - g.T.y || 1));
/** Pose (roulis) d'un POINT de la tête (repère tête) : la chaîne base du cou → haut du cou → crâne, avant le lacet. Sans `rig` : identité. */
export function poseHead(p: V3, v: View, limb: Limb): V3 {
  const g = v.rig;
  if (!g || !g.roll) return p;
  return limb === 'neck' ? rot(p, g.bend * bendW(p.y, g), g.B) : rot(rot(p, g.roll - g.bend, g.T), g.bend, g.B);
}
/** Pose d'une DIRECTION (normale) : même rotation, sans translation. `y` = hauteur du point (pour le poids de flexion du cou). */
export function poseDir(n: V3, v: View, limb: Limb, y: number): V3 {
  const g = v.rig;
  if (!g || !g.roll) return n;
  const a = limb === 'neck' ? g.bend * bendW(y, g) : g.roll, ca = Math.cos(a), sa = Math.sin(a);
  return { x: n.x * ca - n.y * sa, y: n.x * sa + n.y * ca, z: n.z };
}

/** Point de la tête → repère caméra (x₁, y₂, z₂), roulis compris si `limb` est donné. */
export function toCam(p0: V3, v: View, limb?: Limb): Cam {
  const p = limb ? poseHead(p0, v, limb) : p0, a = rad(v.yaw), b = rad(v.pitch), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const x1 = p.x * ca - p.z * sa, z1 = p.x * sa + p.z * ca;
  return { x: x1, y: p.y * cb - z1 * sb, z: p.y * sb + z1 * cb };
}

/** Direction (vecteur, sans translation) tête → caméra : roulis (`limb`, hauteur `y`) puis lacet et tangage. */
export const dirToCam = (n: V3, v: View, limb?: Limb, y = 0): Cam => toCam(limb ? poseDir(n, v, limb, y) : n, { yaw: v.yaw, pitch: v.pitch });

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
