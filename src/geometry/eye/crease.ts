import type { Cubic } from './primitives';
import { cubicAt } from './primitives';
import type { OpeningGeometry } from './opening';

// ------------------------------------------------------------------ Pli palpébral

/** Pli supérieur : parallèle au bord libre, remonté de `height × h`, et convergeant vers le canthus interne. */
export function creaseCurve(g: OpeningGeometry, height: number): Cubic | null {
  if (height <= 0.005) return null;
  const dy = -height * g.h;
  return {
    p0: { x: g.pi.x + g.s * g.w * 0.02, y: g.pi.y + dy * 0.05 },
    p1: { x: g.u1.x, y: g.u1.y + dy },
    p2: { x: g.u2.x, y: g.u2.y + dy },
    p3: { x: g.po.x + g.s * g.w * 0.05, y: g.po.y + dy * 0.1 },
  };
}

/** Ordonnée minimale (point le plus haut) d'une cubique. */
export function cubicTopY(c: Cubic): number {
  let y = Infinity;
  for (let i = 0; i <= 32; i++) y = Math.min(y, cubicAt(c.p0, c.p1, c.p2, c.p3, i / 32).y);
  return y;
}
