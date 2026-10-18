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

/** Boîte englobante. Boucle (et non `Math.min(...xs)`) : une chevelure à des milliers de sommets ferait déborder la pile d'appels. */
export function polyBox(p: Poly): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const v of p) {
    if (v.x < x0) x0 = v.x;
    if (v.x > x1) x1 = v.x;
    if (v.y < y0) y0 = v.y;
    if (v.y > y1) y1 = v.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const mirrorX = (v: Vec): Vec => ({ x: -v.x, y: v.y });
export const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
