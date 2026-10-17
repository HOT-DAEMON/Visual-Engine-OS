import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams, HairStyle, HairTexture } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import type { Poly } from '../poly';
import type { Guard } from './guard';
import type { Hairline } from './hairline';
import { rot, sub, unit } from './noise';
import { plait, ribbon } from './ribbon';
import { displace, resample, samplesFor, type TexSpec } from './texture';
import type { HairLock, LockRank } from './types';

/**
 * Définition d'une coiffure = champ de direction + longueur + largeur. `radial/sweep/back` pondèrent trois
 * directions locales (radiale depuis le crâne, balayée loin de la raie, tirée vers l'arrière) ; `gravity`
 * courbe la mèche vers le bas. Longueurs en fraction de H, largeurs en fraction de W.
 */
export interface StyleDef {
  readonly radial: number;
  readonly sweep: number;
  readonly back: number;
  readonly gravity: number;
  readonly len: readonly [number, number];
  readonly jitter: number;
  readonly off: readonly [number, number];
  readonly mainW: readonly [number, number];
  readonly sharp: number;
  readonly hang?: boolean;
}

export const STYLES: Record<Exclude<HairStyle, 'bald'>, StyleDef> = {
  buzz: { radial: 1, sweep: 0, back: 0, gravity: 0, len: [0.012, 0], jitter: 0.1, off: [0.004, 0], mainW: [0.01, 0], sharp: 0.2 },
  short: { radial: 0.4, sweep: 0.6, back: 0.3, gravity: 0.12, len: [0.07, 0.06], jitter: 0.25, off: [0.01, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
  spiky: { radial: 1, sweep: 0, back: 0.7, gravity: 0, len: [0.07, 0.07], jitter: 0.4, off: [0.008, 0.02], mainW: [0.03, 0.016], sharp: 1 },
  curly: { radial: 0.8, sweep: 0.3, back: 0.1, gravity: 0.25, len: [0.15, 0.12], jitter: 0.35, off: [0.05, 0.08], mainW: [0.04, 0.02], sharp: 0.4 },
  afro: { radial: 1, sweep: 0, back: 0.15, gravity: 0.04, len: [0.22, 0.2], jitter: 0.55, off: [0.1, 0.15], mainW: [0.05, 0.025], sharp: 0.2 },
  bob: { radial: 0.9, sweep: 0.35, back: 0, gravity: 1.5, len: [0.3, 0.1], jitter: 0.12, off: [0.018, 0.03], mainW: [0.034, 0.014], sharp: 0.5, hang: true },
  long: { radial: 0.9, sweep: 0.35, back: 0, gravity: 1.2, len: [0.5, 0.3], jitter: 0.12, off: [0.018, 0.03], mainW: [0.034, 0.014], sharp: 0.5, hang: true },
  ponytail: { radial: 0.3, sweep: 0.2, back: 0.9, gravity: 0, len: [0.1, 0.05], jitter: 0.18, off: [0.008, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
  bun: { radial: 0.3, sweep: 0.2, back: 0.9, gravity: 0, len: [0.1, 0.05], jitter: 0.18, off: [0.008, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
  braids: { radial: 0.2, sweep: 0.8, back: 0.4, gravity: 0.1, len: [0.09, 0.05], jitter: 0.18, off: [0.008, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
};

/** Contexte partagé par tous les générateurs de mèches d'une chevelure. */
export interface HairCtx {
  readonly h: FaceParams['hair'];
  readonly lm: FaceLandmarks;
  readonly hl: Hairline;
  readonly arc: Vec[];
  readonly guard: Guard;
  readonly rnd: () => number;
  readonly nz: (x: number) => number;
  readonly tex: HairTexture;
  readonly spec: TexSpec;
  readonly def: StyleDef;
  /** Centre des directions radiales et abscisse de la raie. */
  readonly C: Vec;
  readonly partX: number;
}

/** Direction initiale locale à la racine R : mélange radial / balayage loin de la raie / vers l'arrière, + jitter. */
export function initialDir(ctx: HairCtx, R: Vec): Vec {
  const { def, C, partX } = ctx;
  const sg = R.x - partX < 0 ? -1 : 1;
  const rad = unit(sub(R, C));
  const v = {
    x: rad.x * def.radial + sg * def.sweep + sg * 0.2 * def.back,
    y: rad.y * def.radial + 0.35 * def.sweep - def.back,
  };
  return rot(unit(v), (ctx.rnd() - 0.5) * 2 * def.jitter);
}

/** Longueur cible d'une mèche (px) : style, volume/longueur, variation d'une mèche à l'autre, rétrécissement par la texture. */
export function lockLen(ctx: HairCtx, fine: boolean): number {
  const { h, def, lm } = ctx;
  const grow = def.hang ? h.length : h.volume;
  const base = (def.len[0] + def.len[1] * grow) * lm.H;
  return base * (1 + (ctx.rnd() - 0.5) * h.lengthVariance * 1.4) * (fine ? 0.85 : 1) * ctx.spec.shrink;
}

/** Ligne médiane : intégration pas à pas de la direction avec courbure de gravité ; arrêt à `yEnd` pour les mèches pendantes. */
export function growLock(ctx: HairCtx, R: Vec, len: number, opts: { dir?: Vec; yEnd?: number; gravity?: number } = {}): Vec[] {
  const { H } = ctx.lm;
  let dir = opts.dir ?? initialDir(ctx, R);
  const g = opts.gravity ?? ctx.def.gravity;
  const n = opts.yEnd === undefined ? 16 : clamp(Math.ceil(len / (0.02 * H)), 16, 90);
  const ds = len / n;
  const pts: Vec[] = [R];
  let pos = R;
  for (let i = 0; i < n; i++) {
    dir = unit({ x: dir.x, y: dir.y + (g * ds) / (0.08 * H) });
    pos = { x: pos.x + dir.x * ds, y: pos.y + dir.y * ds };
    pts.push(pos);
    if (opts.yEnd !== undefined && pos.y >= opts.yEnd && dir.y > 0.2) break;
  }
  return pts;
}

/** Courbe de R vers E (mèches ramenées vers une attache) : tangente de départ = direction locale. */
export function capTo(ctx: HairCtx, R: Vec, E: Vec): Vec[] {
  const d = Math.hypot(E.x - R.x, E.y - R.y) || 1;
  const d0 = initialDir(ctx, R);
  const u = unit(sub(E, R));
  const P1 = { x: R.x + d0.x * 0.4 * d, y: R.y + d0.y * 0.4 * d };
  const P2 = { x: E.x - u.x * 0.3 * d, y: E.y - u.y * 0.3 * d - 0.1 * d };
  return Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const w = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3];
    return { x: w[0]! * R.x + w[1]! * P1.x + w[2]! * P2.x + w[3]! * E.x, y: w[0]! * R.y + w[1]! * P1.y + w[2]! * P2.y + w[3]! * E.y };
  });
}

export interface LockOpts {
  readonly width: number;
  readonly rank: LockRank;
  readonly tone: number;
  readonly layer: 'front' | 'back';
  readonly sharp?: number;
  /** Mode du garde-fou (mèches avant) ; ignoré à l'arrière (cachées par la tête). */
  readonly mode?: 'cap' | 'fringe';
  /** Pas de texture (ligne déjà finale : frange, bord de chignon). */
  readonly raw?: boolean;
}

/** Ligne médiane → mèche(s) : texture, ruban (ou tresse en texture `braided`), puis garde-fou sur chaque sommet avant. */
export function lockFrom(ctx: HairCtx, centre: Vec[], o: LockOpts): HairLock[] {
  const wide = o.rank === 'main' ? ctx.spec.wide : 1;
  const guardPoly = (poly: Poly): Poly => (o.layer === 'front' ? ctx.guard.fit(poly, o.mode ?? 'cap') : poly);
  if (ctx.tex === 'braided' && o.rank === 'main' && !o.raw) {
    const c = resample(centre, 36);
    return plait(c, o.width * 0.9).segs.map((poly, i) => ({ poly: guardPoly(poly), rank: 'plait', tone: i % 2 === 0 ? o.tone : o.tone - 0.18, layer: o.layer, edge: true }));
  }
  const c = o.raw ? centre : displace(resample(centre, samplesFor(Math.hypot(...[(centre[centre.length - 1] as Vec).x - (centre[0] as Vec).x, (centre[centre.length - 1] as Vec).y - (centre[0] as Vec).y]) * 1.25, ctx.spec)), ctx.spec, ctx.rnd() * 6.283, ctx.nz);
  return [{ poly: guardPoly(ribbon(c, o.width * wide, o.sharp ?? ctx.def.sharp)), rank: o.rank, tone: o.tone, layer: o.layer, edge: o.rank === 'main' }];
}
