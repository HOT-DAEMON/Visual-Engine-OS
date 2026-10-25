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

/** Polygone + sa boîte englobante, calculée UNE fois : sert à écarter d'un test de point la plupart des polygones sans parcourir leurs sommets. */
export interface BoxedPoly { readonly q: Poly; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }

/**
 * Polygones de `polys` qui touchent la région `[rx0,rx1]×[ry0,ry1]`, avec leur boîte. Exact : un polygone dont la boîte ne recoupe pas
 * la région ne peut contenir aucun point de la région, donc l'écarter ne change aucun résultat d'appartenance (testé contre `inPoly` seul).
 */
export function polysTouching(polys: readonly Poly[], rx0: number, rx1: number, ry0: number, ry1: number): BoxedPoly[] {
  const out: BoxedPoly[] = [];
  for (const q of polys) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of q) { if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; }
    if (x1 >= rx0 && x0 <= rx1 && y1 >= ry0 && y0 <= ry1) out.push({ q, x0, x1, y0, y1 });
  }
  return out;
}

/** Vrai si l'un des polygones (pré-filtrés par `polysTouching`) contient le point : boîte d'abord, sommets ensuite. */
export function anyContains(cands: readonly BoxedPoly[], x: number, y: number): boolean {
  for (const c of cands) if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1 && inPoly(c.q, x, y)) return true;
  return false;
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
