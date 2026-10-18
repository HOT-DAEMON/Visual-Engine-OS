import type { Vec } from '../../geometry/eye/primitives';
import { capTo, growLock, lockFrom, lockLen, type HairCtx } from './flow';
import { arcAt } from './hairline';
import { textureAt } from './mixtex';
import { keepRoot } from './scalp';
import { tierOf, tierScale } from './layers';
import type { HairLock } from './types';

const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Données de la coiffure nécessaires à la boucle des mèches classiques (attaches, tresses, longueur des mèches pendantes). */
export interface ClassicInput {
  readonly spots: Vec[];
  readonly braids: { at: Vec; sg: number }[];
  /** Ordonnée d'arrêt d'une mèche pendante (tirage inclus) ; appelée une fois par mèche pendante. */
  readonly yHang: () => number;
}

/**
 * Mèches « moyennes » (`main`) et « fines » (`fine`) réparties sur le crâne : racine tirée sous contrainte de densité
 * (éclaircissement, variation de zone), direction du champ local, longueur étagée par couche (`tiers`), texture de la
 * ZONE (mélange de textures), pointe retroussée / irrégulière (`tips`) et gain de silhouette du côté de la racine.
 * Les mèches les plus profondes sont dessinées en premier : tri par profondeur t décroissante, `main` avant `fine`.
 */
export function classicLocks(ctx: HairCtx, inp: ClassicInput): HairLock[] {
  const { h, lm, hl, arc, rnd } = ctx;
  const { H, W } = lm;
  const braided = ctx.tex === 'braided';
  const nMain = h.style === 'buzz' ? 0 : Math.round((braided ? 9 : 16) + (braided ? 8 : 26) * h.density);
  const nFine = h.style === 'buzz' ? Math.round(120 * (0.4 + h.density)) : braided ? 0 : Math.round((40 + 120 * h.density) * h.strands.fine);
  const wMain = (ctx.def.mainW[0] + ctx.def.mainW[1] * h.volume) * W;
  const nearest = (R: Vec, pts: Vec[]): Vec => pts.reduce((a, b) => (Math.abs(b.x - R.x) < Math.abs(a.x - R.x) ? b : a));
  const entries: { t: number; rank: 'main' | 'fine'; locks: HairLock[] }[] = [];
  for (const rank of ['main', 'fine'] as const) {
    const n = rank === 'main' ? nMain : nFine;
    for (let i = 0; i < n; i++) {
      const s = -1 + (2 * (i + rnd())) / n;
      const t = Math.min(1, rnd() ** 1.4);
      if (!keepRoot(ctx, s, t)) continue;
      const R = lerpV(hl.at(s), arcAt(arc, s), t);
      const tier = tierOf(ctx);
      const tex = textureAt(ctx, s, t);
      const g = ctx.gain(s) * tierScale(ctx, tier);
      let centre: Vec[];
      if (inp.spots.length) {
        const T = nearest(R, inp.spots);
        centre = capTo(ctx, R, T.y < -H / 2 + 0.01 * H ? { x: T.x + (rnd() - 0.5) * 0.01 * W, y: T.y + rnd() * 0.01 * H } : arcAt(arc, s));
      } else if (inp.braids.length) centre = capTo(ctx, R, lerpV(R, nearest(R, inp.braids.map((b) => b.at)), 0.55 + 0.45 * rnd()));
      else if (ctx.def.hang) centre = growLock(ctx, R, 2.2 * H, { yEnd: R.y + (inp.yHang() - R.y) * Math.min(1.3, g) });
      else centre = growLock(ctx, R, lockLen(ctx, rank === 'fine') * g);
      const width = rank === 'main' ? wMain : Math.max(0.004 * W, wMain * 0.28);
      const dark = rnd() < 0.25;
      const tone = rank === 'main' ? -(0.1 + 0.4 * rnd()) * h.highlight - 0.08 * tier : (dark ? -0.5 : 1) * (0.1 + 0.7 * rnd()) * h.highlight;
      entries.push({ t, rank, locks: lockFrom(ctx, centre, { width, rank, tone, layer: 'front', tier, tex: tex === ctx.tex ? undefined : tex, edgeFade: h.tips.edgeFade, fade: rank === 'fine' ? h.tips.fade : h.tips.fade * 0.6, flick: h.tips.flick, ragged: h.tips.irregular }) });
    }
  }
  // Étages les plus longs d'abord (au fond), puis profondeur décroissante, `main` avant `fine`.
  entries.sort((a, b) => (a.rank === b.rank ? b.t - a.t : a.rank === 'main' ? -1 : 1));
  return entries.flatMap((e) => e.locks).sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
}
