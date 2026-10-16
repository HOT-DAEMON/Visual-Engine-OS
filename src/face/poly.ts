import type { Vec } from '../geometry/eye/primitives';

/** Polygone fermé (dernier point relié au premier). Géométrie pure : sert au rendu ET aux tests de non-chevauchement. */
export type Poly = Vec[];

export function polyArea(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const u = p[i] as Vec;
    const v = p[(i + 1) % p.length] as Vec;
    a += u.x * v.y - v.x * u.y;
  }
  return a / 2;
}

/** Sens de parcours unique pour toutes les formes d'un même calque : leur union (fill nonzero) est alors sans trou. */
export const orient = (p: Poly): Poly => (polyArea(p) < 0 ? [...p].reverse() : p);

/** Point dans le polygone (règle pair-impair). */
export function inPoly(p: Poly, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i] as Vec;
    const b = p[j] as Vec;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polyBox(p: Poly): { x: number; y: number; w: number; h: number } {
  const xs = p.map((v) => v.x);
  const ys = p.map((v) => v.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export const mirrorX = (v: Vec): Vec => ({ x: -v.x, y: v.y });
export const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
