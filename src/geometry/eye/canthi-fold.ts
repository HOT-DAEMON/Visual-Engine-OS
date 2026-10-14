import type { EyeSpec } from '../../schema';
import type { OpeningGeometry } from './opening';
import { lowerFrame, upperFrame } from './opening';
import { cubicAt, type Cubic } from './primitives';
import type { Vec } from './primitives';

// ------------------------------------------------------------------ Caroncule et pli épicanthique

export interface Caruncle {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

export function caruncleOf(g: OpeningGeometry, size: number): Caruncle | null {
  if (size <= 0.005) return null;
  const a = upperFrame(g, 0.07).pos;
  const b = lowerFrame(g, 0.07).pos;
  const rx = g.w * 0.04 * (0.35 + 0.65 * size);
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, rx, ry: rx * 1.2 };
}

export interface FoldGeometry {
  /** Extrémités de la nouvelle bordure de la fente sur les bords supérieur et inférieur. */
  readonly pu: Vec;
  readonly pl: Vec;
  readonly c1: Vec;
  readonly c2: Vec;
  /** Recouvrement horizontal maximal depuis le canthus interne. */
  readonly cover: number;
  /** Contour fermé de la zone recouverte (sommets, dans l'ordre). */
  readonly region: Vec[];
  /** Arête extérieure du pli : arc côté nez, du haut du canthus vers le bas. */
  readonly arc: Cubic;
}

/**
 * Le pli recouvre le canthus interne : la fente se termine par une extrémité arrondie (raccordée en
 * tangente aux bords libres), et une arête de peau court côté nez.
 */
export function foldGeometry(g: OpeningGeometry, fold: EyeSpec['epicanthicFold']): FoldGeometry | null {
  if (fold.amount <= 0.001) return null;
  const cover = fold.amount * (0.03 + 0.09 * fold.reach) * g.w;
  const tFor = (at: (t: number) => Vec, c: number): number => {
    for (let k = 0; k <= 64; k++) {
      if (Math.abs(at(k / 64).x - g.pi.x) >= c) return k / 64;
    }
    return 1;
  };
  const upAt = (t: number): Vec => upperFrame(g, t).pos;
  const loAt = (t: number): Vec => lowerFrame(g, t).pos;
  const tu = tFor(upAt, cover);
  const tl = tFor(loAt, cover * 0.85);
  const pu = upAt(tu);
  const pl = loAt(tl);
  const Tu = upperFrame(g, tu).T;
  const Tl = lowerFrame(g, tl).T;
  const k = cover * 0.9;
  // Raccord C1 : on quitte le bord supérieur vers le canthus (-Tu) et on rejoint le bord inférieur dans le sens +Tl.
  const c1: Vec = { x: pu.x - Tu.x * k, y: pu.y - Tu.y * k };
  const c2: Vec = { x: pl.x - Tl.x * k, y: pl.y - Tl.y * k };

  const region: Vec[] = [];
  const M = 12;
  for (let i = 0; i <= M; i++) region.push(cubicAt(pu, c1, c2, pl, i / M));
  for (let i = 1; i <= M; i++) region.push(loAt(tl * (1 - i / M)));
  region.push({ x: g.pi.x - g.s * cover * 0.35, y: g.pi.y });
  for (let i = 1; i < M; i++) region.push(upAt((tu * i) / M));

  const S: Vec = { x: g.pi.x + g.s * g.w * 0.02, y: g.pi.y - g.h * 0.12 };
  const E: Vec = { x: g.pi.x + g.s * g.w * 0.005, y: g.pi.y + g.h * 0.16 };
  const arc: Cubic = {
    p0: S,
    p1: { x: S.x - g.s * cover * 1.4, y: S.y + g.h * 0.04 },
    p2: { x: E.x - g.s * cover * 1.6, y: E.y - g.h * 0.05 },
    p3: E,
  };
  return { pu, pl, c1, c2, cover, region, arc };
}

