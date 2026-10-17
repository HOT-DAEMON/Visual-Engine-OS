import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import { orient, type Poly } from '../poly';
import { lockFrom, type HairCtx } from './flow';
import type { HairLock } from './types';

const tri = (u: number): number => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);

export interface Fringe {
  readonly locks: HairLock[];
  /** Zone pleine entre la naissance des cheveux et le bord de la frange. */
  readonly base: Poly;
  /** Bord inférieur (de droite à gauche) : jamais plus bas que la limite des sourcils − 0,008 H, dents comprises. */
  readonly bottom: Vec[];
}

/**
 * Frange : tombe de la ligne d'implantation (réelle, donc irrégulière) jusqu'au-dessus des sourcils, jamais dessus.
 * Dents (longueurs inégales), coins relevés (pas de bord carré contre les pattes), balayage selon la raie.
 */
export function buildFringe(ctx: HairCtx): Fringe | null {
  const { h, lm, hl, guard, rnd } = ctx;
  if (h.fringe === 'none' || h.style === 'buzz') return null;
  const { H, W } = lm;
  const yF = guard.yF;
  const d = 0.012 * H;
  const xF = guard.hw(yF) * 0.985;
  const yC = lm.hair.centerY;
  const teeth = 9 + Math.floor(rnd() * 5);
  const depth = Array.from({ length: teeth }, () => (0.3 + 0.7 * rnd()) * d * (0.4 + 0.6 * h.lengthVariance + 0.4));
  const sp = h.part >= 0 ? 1 : -1;
  const room = yF - d - yC - 0.015 * H;
  const shape = (x: number): number => {
    const a = x / xF;
    const corner = 0.7 * room * Math.abs(a) ** 4;
    if (h.fringe === 'straight') return yF - d - 0.004 * H - corner;
    if (h.fringe === 'sweep') return yF - d - (1 - clamp((-sp * a + 1) / 2, 0, 1)) * 0.045 * H - corner;
    return yF - d - (1 - Math.abs(a)) ** 1.3 * room;
  };
  const bottomAt = (x: number, tooth: number): number => Math.min(yF, Math.max(hl.yAt(x) + 0.004 * H, shape(x) + tooth));
  const bottom: Vec[] = Array.from({ length: 49 }, (_, i) => {
    const a = 1 - (2 * i) / 48;
    const pos = ((1 - a) / 2) * teeth;
    return { x: a * xF, y: bottomAt(a * xF, (depth[Math.min(teeth - 1, Math.floor(pos))] as number) * tri(pos)) };
  });
  const top = hl.pts.filter((q) => Math.abs(q.x) <= xF);
  const base = orient([...top, ...bottom]);
  const K = 14 + Math.round(8 * h.density);
  const locks: HairLock[] = [];
  for (let i = 0; i < K; i++) {
    const x = -xF + (2 * xF * (i + 0.5 * rnd())) / (K - 1);
    const a = x / xF;
    const drift = h.fringe === 'sweep' ? sp * 0.05 * W * (0.5 + rnd()) : h.fringe === 'curtain' ? Math.sign(a || 1) * 0.06 * W * Math.abs(a) : (rnd() - 0.5) * 0.02 * W;
    const xe = clamp(x + drift, -xF, xF);
    const R = { x, y: hl.yAt(x) - 0.012 * H };
    const E = { x: xe, y: bottomAt(xe, (depth[Math.floor(rnd() * teeth)] as number) * rnd()) };
    const C = { x: x + drift * 0.2, y: R.y + 0.6 * (E.y - R.y) };
    const centre = Array.from({ length: 9 }, (_, j) => {
      const t = j / 8;
      return { x: (1 - t) ** 2 * R.x + 2 * (1 - t) * t * C.x + t * t * E.x, y: (1 - t) ** 2 * R.y + 2 * (1 - t) * t * C.y + t * t * E.y };
    });
    locks.push(...lockFrom(ctx, centre, { width: (2 * xF * 1.6) / K, rank: 'main', tone: -(0.05 + 0.3 * rnd()) * h.highlight, layer: 'front', sharp: 0.5, mode: 'fringe' }));
  }
  return { locks, base, bottom };
}
