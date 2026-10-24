import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { inPoly, type Poly } from '../poly';
import { earEngine, earGeometry } from '../ears-geometry';
import { lockFrom, type HairCtx } from './flow';
import { rot } from './noise';
import type { HairLock, SideInfo } from './types';

const SIDES = [{ name: 'left', sg: -1 }, { name: 'right', sg: 1 }] as const;

/**
 * Zone de l'oreille (polygone, repère de l'hôte) : MÊME formule que le rendu des oreilles (`render/face/ears.ts`) —
 * position sur le contour, entre la ligne des yeux et la base du nez, rotation `sg · tiltDeg`. Source unique pour que
 * le comportement des cheveux (cachée / dégagée / rangée) soit calculé sur l'oreille réellement dessinée.
 */
export function earZone(p: FaceParams, ctx: HairCtx, sg: -1 | 1): Poly {
  const { lm, guard } = ctx;
  // Moteur d'oreille `morphology` : la zone est la silhouette de l'oreille réellement dessinée (une seule géométrie pour le rendu, les ombres et les cheveux).
  if (earEngine(p) === 'morphology') {
    const g = earGeometry(p, lm).find((e) => e.side === sg);
    if (g) return g.poly;
  }
  const w = p.ears.size * lm.W;
  const h = w * p.ears.aspect;
  const cy = (lm.eyeY + lm.noseBaseY) / 2;
  const cx = sg * (guard.hw(cy) + w * 0.18);
  const a = (sg * p.ears.tiltDeg * Math.PI) / 180;
  return Array.from({ length: 24 }, (_, i) => {
    const th = (2 * Math.PI * i) / 24;
    const q = rot({ x: (w / 2) * Math.cos(th), y: (h / 2) * Math.sin(th) }, a);
    return { x: cx + q.x, y: cy + q.y };
  });
}

/** Part (0–1) d'une zone couverte par l'union de polygones : échantillonnage 18 × 18 de la boîte de la zone, filtré par la zone. */
export function coverageOf(polys: Poly[], zone: Poly): number {
  const xs = zone.map((q) => q.x);
  const ys = zone.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let inside = 0;
  let covered = 0;
  for (let i = 0; i < 18; i++) {
    for (let j = 0; j < 18; j++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / 18;
      const y = y0 + ((y1 - y0) * (j + 0.5)) / 18;
      if (!inPoly(zone, x, y)) continue;
      inside++;
      if (polys.some((q) => inPoly(q, x, y))) covered++;
    }
  }
  return inside === 0 ? 0 : covered / inside;
}

/** Comportement 'auto' : les coiffures longues / volumineuses cachent l'oreille ; les courtes et les attaches la dégagent ; les tresses la rangent. */
function resolveEar(ctx: HairCtx, want: FaceParams['hair']['sides']['left']['ear']): SideInfo['ear'] {
  if (want !== 'auto') return want;
  const s = ctx.h.style;
  return s === 'bob' || s === 'long' || s === 'afro' || s === 'curly' ? 'covered' : s === 'braids' ? 'tucked' : 'free';
}

const hitsZone = (poly: Poly, zone: Poly): boolean => zone.some((q) => inPoly(poly, q.x, q.y)) || poly.some((q) => inPoly(zone, q.x, q.y));

/** Courbe quadratique A → B de contrôle C (12 points). */
const quad = (a: Vec, c: Vec, b: Vec): Vec[] =>
  Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y };
  });

export interface SidesResult {
  readonly front: HairLock[];
  readonly back: HairLock[];
  readonly info: { readonly left: SideInfo; readonly right: SideInfo };
}

/**
 * Comportement PROPRE À CHAQUE CÔTÉ (asymétrie multidirectionnelle). Pour chaque côté de l'image :
 *  - `covered` : un rideau de 3+ mèches tombe du temple devant l'oreille jusqu'en dessous d'elle (≥ 60 % couverte, mesuré) ;
 *  - `free`    : toute mèche qui toucherait l'oreille passe DERRIÈRE la tête (calque arrière) : l'oreille est dégagée ;
 *  - `tucked`  : comme `free`, plus une petite mèche rangée qui coiffe le haut de l'oreille ;
 *  - `cheek`   : mèche de joue, devant l'oreille (garde-fou `cheek`) : courte (bas de l'oreille) ou longue (coin de mâchoire).
 * Les deux côtés sont résolus indépendamment : on peut cacher l'oreille gauche et dégager la droite.
 */
export function applySides(ctx: HairCtx, p: FaceParams, frontIn: HairLock[], backIn: HairLock[]): SidesResult {
  const { h, lm, guard, rnd } = ctx;
  const { H, W } = lm;
  let front = [...frontIn];
  const back = [...backIn];
  const info = {} as { left: SideInfo; right: SideInfo };
  for (const { name, sg } of SIDES) {
    const zone = earZone(p, ctx, sg);
    const want = h.sides[name];
    const ear = resolveEar(ctx, want.ear);
    const ys = zone.map((q) => q.y);
    const [yTop, yBot] = [Math.min(...ys), Math.max(...ys)];
    const yT = lm.hair.templeY;
    const T = { x: sg * guard.hw(yT) * 0.985, y: yT };
    if (ear !== 'covered') {
      // Les mèches qui touchent l'oreille passent derrière la tête (hors frange, joue et mèches qui passent devant).
      const keep: HairLock[] = [];
      for (const l of front) (l.sim === true || l.kind === 'lock' || l.kind === 'flow' || l.kind === 'wisp' || l.kind === undefined) && hitsZone(l.poly, zone) ? back.push({ ...l, layer: 'back' }) : keep.push(l);
      front = keep;
    }
    if (ear === 'covered') {
      // Rideau devant l'oreille ; on ajoute des mèches (plus larges à chaque essai) jusqu'à couvrir ≥ 60 % de la zone.
      const cx = zone.reduce((a, q) => a + q.x, 0) / zone.length;
      const earW = Math.max(...zone.map((q) => q.x)) - Math.min(...zone.map((q) => q.x));
      for (let k = 0; k < 6; k++) {
        const polys = front.map((l) => l.poly);
        if (k >= 2 && coverageOf(polys, zone) >= 0.6) break;
        // Mèches centrées sur l'oreille, à bout presque carré (sharp bas) et plus larges à chaque essai : elles recouvrent toute sa hauteur.
        const xe = cx + (rnd() - 0.5) * 0.4 * earW;
        const E = { x: xe, y: yBot + (0.02 + 0.03 * rnd()) * H };
        const c = quad({ x: T.x, y: T.y - 0.01 * H }, { x: (T.x + xe) / 2 + sg * 0.01 * W, y: (T.y + E.y) / 2 }, E);
        front.push(...lockFrom(ctx, c, { width: Math.max(earW * (0.9 + 0.25 * k), W * 0.05) * (0.9 + 0.2 * rnd()), rank: 'main', tone: -(0.05 + 0.25 * rnd()), layer: 'front', sharp: 0.12, raw: true, kind: 'cheek', ragged: h.tips.irregular }));
      }
    } else if (ear === 'tucked') {
      // Mèche rangée : part du temple, coiffe le haut de l'oreille et disparaît derrière elle.
      const E = { x: (zone[0] as Vec).x - sg * 0.01 * W, y: yTop + 0.35 * (yBot - yTop) };
      front.push(...lockFrom(ctx, quad(T, { x: T.x + sg * 0.03 * W, y: (T.y + E.y) / 2 }, E), { width: W * 0.035, rank: 'main', tone: -0.12, layer: 'front', sharp: 0.9, raw: true, kind: 'tuft' }));
    }
    if (want.cheek !== 'none') {
      const yEnd = want.cheek === 'short' ? yBot : lm.jawY - 0.04 * H;
      const A = { x: sg * guard.hw(yT + 0.02 * H) * 0.97, y: yT };
      const B = { x: sg * (guard.hw(yEnd) - 0.04 * W), y: yEnd };
      front.push(...lockFrom(ctx, quad(A, { x: A.x - sg * 0.01 * W, y: (A.y + B.y) / 2 }, B), { width: W * (0.028 + 0.012 * rnd()), rank: 'main', tone: -(0.05 + 0.2 * rnd()), layer: 'front', sharp: 0.95, raw: true, mode: 'cheek', kind: 'cheek', ragged: h.tips.irregular }));
    }
    info[name] = { ear, cheek: want.cheek, earZone: zone };
  }
  return { front, back, info };
}
