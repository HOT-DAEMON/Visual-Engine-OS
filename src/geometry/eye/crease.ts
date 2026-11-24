import type { Cubic } from './primitives';
import { cubicAt, type Vec } from './primitives';
import type { OpeningGeometry } from './opening';

// ------------------------------------------------------------------ Pli palpébral

/**
 * Part du déplacement du bord libre (EYE-07E) que le pli palpébral hérite : le pli est le sillon d'insertion de l'aponévrose du releveur, tenu au tarse par des fibres lâches —
 * il suit l'ondulation LENTE du bord (0,6) sans en reprendre le festonnage fin ; les extrémités (canthi) restent ancrées.
 */
export const CREASE_FOLLOW = 0.6;

/** Pli supérieur : parallèle au bord libre, remonté de `height × h`, et convergeant vers le canthus interne. `edgeShift(t)` (bord irrégulier) : déplacement du bord au paramètre t. */
export function creaseCurve(g: OpeningGeometry, height: number, edgeShift?: (t: number) => Vec): Cubic | null {
  if (height <= 0.005) return null;
  const dy = -height * g.h;
  const a = edgeShift ? edgeShift(1 / 3) : { x: 0, y: 0 }; const b = edgeShift ? edgeShift(2 / 3) : { x: 0, y: 0 };
  return {
    p0: { x: g.pi.x + g.s * g.w * 0.02, y: g.pi.y + dy * 0.05 },
    p1: { x: g.u1.x + a.x * CREASE_FOLLOW, y: g.u1.y + dy + a.y * CREASE_FOLLOW },
    p2: { x: g.u2.x + b.x * CREASE_FOLLOW, y: g.u2.y + dy + b.y * CREASE_FOLLOW },
    p3: { x: g.po.x + g.s * g.w * 0.05, y: g.po.y + dy * 0.1 },
  };
}

/** Ordonnée minimale (point le plus haut) d'une cubique. */
export function cubicTopY(c: Cubic): number {
  let y = Infinity;
  for (let i = 0; i <= 32; i++) y = Math.min(y, cubicAt(c.p0, c.p1, c.p2, c.p3, i / 32).y);
  return y;
}
