import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import { growLock, lockFrom, type HairCtx } from './flow';
import { unit } from './noise';
import { plait } from './ribbon';
import { resample } from './texture';
import type { HairGeometry, HairLock } from './types';

type Tie = HairGeometry['ties'][number];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Attaches (queue / chignon) : relatives au crâne. Centre : derrière la tête ; côté : posée juste hors du contour. */
export function tieSpots(ctx: HairCtx): Vec[] {
  const { h, lm, guard } = ctx;
  const t = h.tie;
  const { H, W } = lm;
  if (Math.abs(t.side) < 0.2 && !t.double) return [{ x: t.side * 0.3 * W, y: lerp(lm.jawY - 0.1 * H, -H / 2 - 0.035 * H, t.height ** 0.8) }];
  const y = lerp(lm.hair.sideY + 0.22 * H, lm.hair.sideY - 0.09 * H, t.height);
  const x = guard.hw(y) + 0.012 * W;
  return t.double ? [{ x: -x, y }, { x, y }] : [{ x: (t.side < 0 ? -1 : 1) * x, y }];
}

export const tieRing = (ctx: HairCtx, at: Vec): Tie => ({ at, rx: 0.026 * ctx.lm.W * (0.7 + 0.6 * ctx.h.tie.thickness), front: at.y < -ctx.lm.H / 2 + 0.01 * ctx.lm.H });

/** Queue : un cœur sombre + des mèches en éventail qui retombent sous l'effet de la gravité (derrière la tête). */
export function tailLocks(ctx: HairCtx, T: Vec): HairLock[] {
  const { h, lm, rnd } = ctx;
  const { H, W } = lm;
  const kind = T.y < -H / 2 + 0.06 * H && Math.abs(T.x) < 0.2 * W ? 'top' : Math.abs(T.x) >= 0.2 * W ? 'side' : 'low';
  const sg = T.x < 0 ? -1 : 1;
  const len = (0.15 + 0.55 * h.tie.tail) * H;
  const bw = (0.045 + 0.06 * h.tie.thickness) * W;
  const dirOf = (): Vec => {
    const a = (rnd() - 0.5) * 1.5;
    return kind === 'top' ? unit({ x: Math.sin(a) * 1.3, y: -Math.cos(a) }) : kind === 'side' ? unit({ x: sg, y: -0.15 + (rnd() - 0.5) * 0.6 }) : unit({ x: (rnd() - 0.5) * 0.6, y: 1 });
  };
  const core = lockFrom(ctx, growLock(ctx, T, len, { dir: dirOf(), gravity: 0.9 }), { width: bw * 1.6, rank: 'main', tone: -0.3, layer: 'back', sharp: 0.45 });
  if (ctx.tex === 'braided') return core;
  const locks = [...core];
  const count = Math.round(12 + 22 * h.tie.thickness);
  for (let i = 0; i < count; i++) {
    const start = { x: T.x + (rnd() - 0.5) * bw, y: T.y + (rnd() - 0.5) * 0.01 * H };
    const L = len * (0.8 + 0.4 * rnd() - (0.5 - rnd()) * h.lengthVariance * 0.4) * ctx.spec.shrink;
    locks.push(...lockFrom(ctx, growLock(ctx, start, L, { dir: dirOf(), gravity: 0.9 }), { width: bw * 0.5 * (0.6 + 0.8 * rnd()), rank: i % 3 === 0 ? 'main' : 'fine', tone: (rnd() - 0.4) * h.highlight, layer: 'back', sharp: 0.6 }));
  }
  return locks;
}

/** Chignon : disque festonné (boucles, crépu) + trois spirales entrelacées, au-dessus de l'attache. */
export function bunLocks(ctx: HairCtx, T: Vec): HairLock[] {
  const { h, lm } = ctx;
  const { W, H } = lm;
  const rb = (0.09 + 0.12 * h.tie.thickness) * W;
  const B = T.y < -H / 2 + 0.06 * H ? { x: T.x + Math.sign(T.x) * rb * 0.25, y: T.y - rb * 0.35 } : T;
  const scallop = ctx.tex === 'curly' || ctx.tex === 'coily' ? 1 : ctx.tex === 'wavy' ? 0.5 : 0;
  const k = 9 + Math.floor(ctx.rnd() * 5);
  const disc: Poly = Array.from({ length: 48 }, (_, i) => {
    const th = (2 * Math.PI * i) / 48;
    const f = 1 + 0.07 * scallop * Math.abs(Math.sin((k * th) / 2));
    return { x: B.x + Math.cos(th) * rb * f, y: B.y + Math.sin(th) * rb * 0.9 * f };
  });
  const locks: HairLock[] = [{ poly: disc, rank: 'main', tone: -0.35, layer: 'back', edge: true }];
  for (let j = 0; j < 3; j++) {
    const th0 = ctx.rnd() * 6.283;
    const c = Array.from({ length: 26 }, (_, i) => {
      const u = i / 25;
      const th = th0 + 2.4 * Math.PI * u + (j * 2 * Math.PI) / 3;
      const r = rb * 0.85 * (1 - 0.78 * u);
      return { x: B.x + Math.cos(th) * r, y: B.y + Math.sin(th) * r * 0.9 };
    });
    locks.push(...lockFrom(ctx, c, { width: rb * 0.45, rank: 'main', tone: (j - 1) * 0.15 * (0.5 + h.highlight), layer: 'back', sharp: 0.4, raw: ctx.tex !== 'braided' }));
  }
  return locks;
}

/** Racines des tresses pendantes : sur les côtés du crâne, à hauteur de tempe puis plus bas, jamais sur le visage. */
export function braidRoots(ctx: HairCtx): { at: Vec; sg: number }[] {
  const { h, lm, guard } = ctx;
  const n = h.braids.count;
  return Array.from({ length: n }, (_, k) => {
    const sg = n === 1 ? (h.tie.side < 0 ? -1 : 1) : k % 2 === 0 ? -1 : 1;
    const y = lm.hair.sideY + (0.02 + 0.1 * (n === 1 ? 0 : Math.floor(k / 2))) * lm.H;
    return { at: { x: sg * (guard.hw(y) + 0.012 * lm.W), y }, sg };
  });
}

/** Une tresse : chaîne de chevrons, serrée en pointe, terminée par une touffe libre qui montre la texture. */
export function braidLocks(ctx: HairCtx, root: Vec, sg: number): HairLock[] {
  const { h, lm, rnd } = ctx;
  const { H, W } = lm;
  const len = (0.2 + 0.55 * h.tie.tail) * H;
  const c = resample(growLock(ctx, root, len, { dir: unit({ x: sg * 0.5, y: 0.85 }), gravity: 1.2 }), 40);
  const w = (0.03 + 0.035 * h.braids.thickness) * W;
  const { segs, end } = plait(c, w);
  const locks: HairLock[] = segs.map((poly, i) => ({ poly, rank: 'plait', tone: i % 2 === 0 ? 0 : -0.2, layer: 'back', edge: true }));
  for (let i = 0; i < 6; i++) {
    const L = (0.04 + 0.04 * rnd()) * H;
    locks.push(...lockFrom(ctx, growLock(ctx, end, L, { dir: unit({ x: (rnd() - 0.5) * 0.8, y: 1 }), gravity: 1 }), { width: clamp(w * 0.18, 0.004 * W, 0.02 * W), rank: 'fine', tone: (rnd() - 0.4) * h.highlight, layer: 'back', sharp: 0.9 }));
  }
  return locks;
}
