import { dot3, p3, type P3 } from './vec3';

/**
 * CAMÉRA LIBRE (orthographique). `yaw` tourne le CORPS autour de l'axe vertical : 0 = de face · 90 = l'avant du corps tourné vers la DROITE de l'image
 * (profil, on voit le côté droit du corps) · 180 = de dos · −90 = profil gauche. `pitch` bascule le corps (+ = on regarde d'un peu plus haut).
 * Le point de vue ne modifie JAMAIS la géométrie : seule la projection change (la géométrie est calculée et mise en cache une seule fois).
 */
export interface Camera { readonly yaw: number; readonly pitch: number; readonly pivot: { readonly x: number; readonly z: number; readonly y: number } }
export const FRONT: Camera = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
const R = Math.PI / 180;

/** Vers l'espace VUE : x image (droite +), y image (bas +), z = profondeur (grand = plus proche du spectateur). */
export function toView(p: P3, c: Camera): P3 {
  const x0 = p.x - c.pivot.x, y0 = p.y - c.pivot.y, z0 = p.z - c.pivot.z;
  const cy = Math.cos(c.yaw * R), sy = Math.sin(c.yaw * R), cp = Math.cos(c.pitch * R), sp = Math.sin(c.pitch * R);
  const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
  return p3(x1 + c.pivot.x, y0 * cp - z1 * sp + c.pivot.y, y0 * sp + z1 * cp);
}
/** Direction (normale) vers l'espace vue : rotation seule, sans pivot. */
export const dirToView = (n: P3, c: Camera): P3 => { const o = toView(p3(n.x + c.pivot.x, n.y + c.pivot.y, n.z + c.pivot.z), c), q = toView(p3(c.pivot.x, c.pivot.y, c.pivot.z), c); return p3(o.x - q.x, o.y - q.y, o.z - q.z); };
export const facing = (nView: P3): number => dot3(nView, p3(0, 0, 1));
