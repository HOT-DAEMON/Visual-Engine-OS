/**
 * Primitives géométriques 2D partagées par toute la géométrie de l'œil (fonctions pures, sans SVG).
 * Repère local : origine au centre de l'œil, x vers la droite, y vers le bas.
 */
export interface Vec {
  readonly x: number;
  readonly y: number;
}

const norm = (a: Vec): Vec => {
  const n = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / n, y: a.y / n };
};

export interface Cubic {
  readonly p0: Vec;
  readonly p1: Vec;
  readonly p2: Vec;
  readonly p3: Vec;
}

export const cubicAt = (a: Vec, b: Vec, c: Vec, d: Vec, t: number): Vec => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

const cubicDeriv = (a: Vec, b: Vec, c: Vec, d: Vec, t: number): Vec => {
  const u = 1 - t;
  return {
    x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
    y: 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y),
  };
};

export { norm, cubicDeriv };
