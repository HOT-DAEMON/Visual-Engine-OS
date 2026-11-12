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

/**
 * Bornes ANATOMIQUES des attaches (`docs/HAIR-TIE.md`), en fraction de W / H. Source unique : construction ET vérification.
 *  - un chignon latéral se pose sur la partie HAUTE du crâne (entre le sommet + 0,09 H et la tempe) : plus bas, à hauteur d'oreille, il se lit comme un casque audio ;
 *  - un chignon centré est un chignon de dessus : plus bas il est entièrement caché par le crâne (de face, le style `bun` n'aurait aucun chignon) ;
 *  - une queue latérale ne descend pas sous le haut de l'oreille ;
 *  - rayon de chignon ≤ 0,20 W (latéral) / 0,22 W (dessus) : un chignon réel mesure un tiers à deux cinquièmes de la largeur de tête (rayon 0,10–0,20 W) ; au-delà ce n'est plus un chignon.
 *    Les bornes précédentes (0,14 / 0,18 W, rayons construits 0,07–0,14 W) donnaient des « oreilles de souris » (`docs/HAIR-NATURAL.md`) ;
 *  - éventail latéral de la queue ≤ 0,2 W (latérale, basse) / 0,28 W (dessus) autour de l'attache : la gravité l'emporte sur l'éventail.
 */
export const TIE = { bunRadiusSide: 0.2, bunRadiusTop: 0.22, spreadSide: 0.2, spreadTop: 0.28, bunTopBand: 0.09 } as const;

/** Attaches (queue / chignon) : relatives au crâne. Centre : derrière la tête (chignon : sur le dessus) ; côté : posée sur le contour du crâne. */
export function tieSpots(ctx: HairCtx): Vec[] {
  const { h, lm, guard } = ctx;
  const t = h.tie;
  const { H, W } = lm;
  const S = ctx.boundary.skull;
  const bun = h.style === 'bun';
  if (Math.abs(t.side) < 0.2 && !t.double) {
    const y = bun ? lerp(S.topY + 0.03 * H, S.topY - 0.05 * H, t.height) : lerp(lm.jawY - 0.1 * H, S.topY - 0.035 * H, t.height ** 0.8);
    return [{ x: t.side * 0.3 * W, y }];
  }
  const earTop = Math.min(ctx.boundary.marks.earTopY.left, ctx.boundary.marks.earTopY.right);
  const yLow = bun ? lm.hair.sideY + 0.03 * H : Math.min(lm.hair.sideY + 0.22 * H, earTop - 0.01 * H);
  const yHigh = bun ? S.topY + TIE.bunTopBand * H : lm.hair.sideY - 0.09 * H;
  const y = lerp(yLow, yHigh, t.height);
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
  // Longueur plafonnée à la place disponible jusqu'aux épaules (une queue de dos ne passe pas sous le cou rendu) : plus de fond plat écrasé sur `yMax`.
  const avail = Math.max(0.08 * H, lm.neck.bottomY - 0.012 * H - T.y);
  const len = Math.min((0.15 + 0.55 * h.tie.tail) * H, kind === 'top' ? Infinity : 0.97 * avail);
  const bw = (0.045 + 0.06 * h.tie.thickness) * W;
  // La borne latérale vaut pour le BORD du ruban, pas seulement pour sa ligne médiane : on retranche la demi-largeur du cœur (`docs/HAIR-NATURAL.md`, `ponytail` 11556 : portée 0,423 W pour 0,42).
  const spread = Math.max(0.02 * W, (kind === 'top' ? TIE.spreadTop : TIE.spreadSide) * W - 0.4 * bw);
  const dirOf = (): Vec => {
    const a = (rnd() - 0.5) * 1.5;
    return kind === 'top' ? unit({ x: Math.sin(a) * 1.3, y: -Math.cos(a) }) : kind === 'side' ? unit({ x: sg, y: -0.15 + (rnd() - 0.5) * 0.6 }) : unit({ x: (rnd() - 0.5) * 0.6, y: 1 });
  };
  // Une queue basse retombe DANS LE DOS : vue de face elle est arrêtée aux épaules (bas du cou rendu), jamais sous lui (mèches parasites).
  const yMax = lm.neck.bottomY - 0.012 * H;
  const rest = (c: Vec[]): Vec[] => c.map((q) => ({ x: T.x + clamp(q.x - T.x, -spread, spread), y: q.y > yMax ? yMax : q.y }));
  const core = lockFrom(ctx, rest(growLock(ctx, T, len, { dir: dirOf(), gravity: 0.9 })), { width: bw * 1.6, rank: 'main', tone: -0.3, layer: 'back', sharp: 0.45, part: 'tail' });
  if (ctx.tex === 'braided') return core;
  const locks = [...core];
  const count = Math.round(12 + 22 * h.tie.thickness);
  for (let i = 0; i < count; i++) {
    const start = { x: T.x + (rnd() - 0.5) * bw, y: T.y + (rnd() - 0.5) * 0.01 * H };
    const L = len * (0.8 + 0.4 * rnd() - (0.5 - rnd()) * h.lengthVariance * 0.4) * ctx.spec.shrink;
    locks.push(...lockFrom(ctx, rest(growLock(ctx, start, L, { dir: dirOf(), gravity: 0.9 })), { width: bw * 0.5 * (0.6 + 0.8 * rnd()), rank: i % 3 === 0 ? 'main' : 'fine', tone: (rnd() - 0.4) * h.highlight, layer: 'back', sharp: 0.6, part: 'tail' }));
  }
  return locks;
}

/** Chignon : disque festonné (boucles, crépu) + trois spirales entrelacées, au-dessus de l'attache. */
export function bunLocks(ctx: HairCtx, T: Vec): HairLock[] {
  const { h, lm } = ctx;
  const { W, H } = lm;
  const topBun = T.y < lm.hair.sideY - 0.1 * H && Math.abs(T.x) < 0.2 * W;
  const rb = (topBun ? 0.11 + 0.09 * h.tie.thickness : 0.1 + 0.09 * h.tie.thickness) * W;
  // Le chignon est une boule posée SUR le crâne, pas sur son contour : son centre est décalé vers l'extérieur et le haut (la moitié du disque derrière la tête ne se voit pas, d'où
  // l'ancienne « oreille de souris »). Dessus : il dépasse du crâne de 0,6 rayon ; côté : décalé de 0,35 rayon vers l'extérieur et de 0,25 vers le haut.
  const B = T.y < -H / 2 + 0.06 * H ? { x: T.x + Math.sign(T.x) * rb * 0.25, y: T.y - rb * 0.6 } : Math.abs(T.x) >= 0.2 * W ? { x: T.x + Math.sign(T.x) * rb * 0.35, y: T.y - rb * 0.25 } : T;
  const scallop = ctx.tex === 'curly' || ctx.tex === 'coily' ? 1 : ctx.tex === 'wavy' ? 0.5 : 0;
  const k = 9 + Math.floor(ctx.rnd() * 5);
  const disc: Poly = Array.from({ length: 48 }, (_, i) => {
    const th = (2 * Math.PI * i) / 48;
    const f = 1 + 0.07 * scallop * Math.abs(Math.sin((k * th) / 2));
    return { x: B.x + Math.cos(th) * rb * f, y: B.y + Math.sin(th) * rb * 0.9 * f };
  });
  const locks: HairLock[] = [{ poly: disc, rank: 'main', tone: -0.35, layer: 'back', edge: true, part: 'bun' }];
  for (let j = 0; j < 3; j++) {
    const th0 = ctx.rnd() * 6.283;
    const c = Array.from({ length: 26 }, (_, i) => {
      const u = i / 25;
      const th = th0 + 2.4 * Math.PI * u + (j * 2 * Math.PI) / 3;
      const r = rb * 0.85 * (1 - 0.78 * u);
      return { x: B.x + Math.cos(th) * r, y: B.y + Math.sin(th) * r * 0.9 };
    });
    locks.push(...lockFrom(ctx, c, { width: rb * 0.45, rank: 'main', tone: (j - 1) * 0.15 * (0.5 + h.highlight), layer: 'back', sharp: 0.4, raw: ctx.tex !== 'braided', part: 'bun' }));
  }
  return locks;
}

/** Racines des tresses pendantes : sur les côtés du crâne, à hauteur de tempe puis plus bas, jamais sur le visage. */
export function braidRoots(ctx: HairCtx): { at: Vec; sg: number }[] {
  const { h, lm, guard } = ctx;
  const n = h.braids.count;
  // La tresse pend en ligne droite : on la pose hors du point le plus large du visage (joues comprises), de sa demi-largeur.
  const hwMax = Math.max(...Array.from({ length: 14 }, (_, i) => guard.hw(lm.hair.sideY + ((lm.jawY - lm.hair.sideY) * i) / 13)));
  const half = ((0.03 + 0.035 * h.braids.thickness) * lm.W) / 2;
  return Array.from({ length: n }, (_, k) => {
    const sg = n === 1 ? (h.tie.side < 0 ? -1 : 1) : k % 2 === 0 ? -1 : 1;
    const y = lm.hair.sideY + (0.02 + 0.1 * (n === 1 ? 0 : Math.floor(k / 2))) * lm.H;
    return { at: { x: sg * (hwMax + half + 0.012 * lm.W), y }, sg };
  });
}

/** Une tresse : chaîne de chevrons, serrée en pointe, terminée par une touffe libre qui montre la texture. */
export function braidLocks(ctx: HairCtx, root: Vec, sg: number): HairLock[] {
  const { h, lm, rnd } = ctx;
  const { H, W } = lm;
  const len = (0.2 + 0.55 * h.tie.tail) * H;
  const c = resample(growLock(ctx, root, len, { dir: unit({ x: sg * 0.15, y: 1 }), gravity: 1.2 }), 40);
  const w = (0.03 + 0.035 * h.braids.thickness) * W;
  const { segs, end } = plait(c, w);
  const locks: HairLock[] = segs.map((poly, i) => ({ poly, rank: 'plait', tone: i % 2 === 0 ? 0 : -0.2, layer: 'back', edge: true, part: 'braid' }));
  for (let i = 0; i < 6; i++) {
    const L = (0.04 + 0.04 * rnd()) * H;
    locks.push(...lockFrom(ctx, growLock(ctx, end, L, { dir: unit({ x: (rnd() - 0.5) * 0.8, y: 1 }), gravity: 1 }), { width: clamp(w * 0.18, 0.004 * W, 0.02 * W), rank: 'fine', tone: (rnd() - 0.4) * h.highlight, layer: 'back', sharp: 0.9, part: 'braid' }));
  }
  return locks;
}
