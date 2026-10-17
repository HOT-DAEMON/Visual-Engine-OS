import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { buildFringe } from './fringe';
import { capTo, growLock, lockFrom, lockLen, STYLES, type HairCtx } from './flow';
import { makeGuard } from './guard';
import { arcAt, buildHairline, skullArc } from './hairline';
import { noise1 } from './noise';
import { bareScalp, capBase, envelope, keepRoot } from './scalp';
import { braidLocks, braidRoots, bunLocks, tailLocks, tieRing, tieSpots } from './tie';
import { resolveTexture, textureSpec } from './texture';
import type { HairGeometry, HairLock } from './types';

export type { HairGeometry, HairLock, LockRank, BareScalp } from './types';

const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Chevelure complète d'un visage : implantation réelle (forme, tempes, irrégularité), sous-couche racine,
 * mèches principales et secondaires orientées par un champ de direction local, texture appliquée à n'importe
 * quelle coiffure, queue / chignon / tresses attachés au crâne. `null` si chauve. Géométrie pure (sans SVG).
 */
export function hairGeometry(p: FaceParams, lm: FaceLandmarks): HairGeometry | null {
  const h = p.hair;
  if (h.style === 'bald') return null;
  const { W, H } = lm;
  const hl = buildHairline(p, lm);
  const arc = skullArc(lm, hl);
  const tex = resolveTexture(h.style, h.texture);
  const ctx: HairCtx = {
    h, lm, hl, arc, guard: makeGuard(p, lm, hl), rnd: mulberry32(h.seed), nz: noise1(h.seed ^ 0x5a5a), tex,
    spec: textureSpec(tex, h.curl, W, H), def: STYLES[h.style], C: { x: 0, y: h.style === 'spiky' ? lm.eyeY : lm.hair.sideY }, partX: h.part * 0.1 * W,
  };
  const { rnd, def } = ctx;
  const { base, scalp } = capBase(ctx);
  const spots = h.style === 'ponytail' || h.style === 'bun' ? tieSpots(ctx) : [];
  const braids = h.style === 'braids' ? braidRoots(ctx) : [];
  const fringe = buildFringe(ctx);
  const braided = tex === 'braided';
  const nMain = h.style === 'buzz' ? 0 : Math.round((braided ? 9 : 16) + (braided ? 8 : 26) * h.density);
  const nFine = h.style === 'buzz' ? Math.round(120 * (0.4 + h.density)) : braided ? 0 : Math.round(40 + 120 * h.density);
  const wMain = (def.mainW[0] + def.mainW[1] * h.volume) * W;
  const yHang = (): number => (h.style === 'long' ? H / 2 + (0.08 + 0.3 * h.length) * H : lm.jawY + (0.03 + 0.1 * h.length) * H) + (rnd() - 0.5) * h.lengthVariance * 0.18 * H;
  const nearest = (R: Vec, pts: Vec[]): Vec => pts.reduce((a, b) => (Math.abs(b.x - R.x) < Math.abs(a.x - R.x) ? b : a));

  const entries: { t: number; rank: 'main' | 'fine'; locks: HairLock[] }[] = [];
  for (const rank of ['main', 'fine'] as const) {
    const n = rank === 'main' ? nMain : nFine;
    for (let i = 0; i < n; i++) {
      const s = -1 + (2 * (i + rnd())) / n;
      const t = Math.min(1, rnd() ** 1.4);
      if (!keepRoot(ctx, s, t)) continue;
      const R = lerpV(hl.at(s), arcAt(arc, s), t);
      let centre: Vec[];
      if (spots.length) {
        const T = nearest(R, spots);
        centre = capTo(ctx, R, T.y < -H / 2 + 0.01 * H ? { x: T.x + (rnd() - 0.5) * 0.01 * W, y: T.y + rnd() * 0.01 * H } : arcAt(arc, s));
      } else if (braids.length) centre = capTo(ctx, R, lerpV(R, nearest(R, braids.map((b) => b.at)), 0.55 + 0.45 * rnd()));
      else if (def.hang) centre = growLock(ctx, R, 2.2 * H, { yEnd: yHang() });
      else centre = growLock(ctx, R, lockLen(ctx, rank === 'fine'));
      const width = rank === 'main' ? wMain : Math.max(0.004 * W, wMain * 0.28);
      const dark = rnd() < 0.25;
      const tone = rank === 'main' ? -(0.1 + 0.4 * rnd()) * h.highlight : (dark ? -0.5 : 1) * (0.1 + 0.7 * rnd()) * h.highlight;
      entries.push({ t, rank, locks: lockFrom(ctx, centre, { width, rank, tone, layer: 'front' }) });
    }
  }
  entries.sort((a, b) => (a.rank === b.rank ? b.t - a.t : a.rank === 'main' ? -1 : 1));
  const front: HairLock[] = entries.flatMap((e) => e.locks);
  if (fringe) front.push(...fringe.locks);

  const back: HairLock[] = [];
  let backBase = null as HairGeometry['backBase'];
  if (def.hang) {
    for (let i = 0; i < Math.round(nMain * 0.8); i++) {
      const R = arcAt(arc, -1 + 2 * rnd());
      back.push(...lockFrom(ctx, growLock(ctx, R, 2.2 * H, { yEnd: yHang() }), { width: wMain, rank: 'main', tone: -0.25 - 0.2 * rnd(), layer: 'back' }));
    }
    backBase = envelope([...front, ...back].flatMap((l) => l.poly).filter((q) => q.y >= lm.hair.sideY), lm.hair.sideY, Math.max(...back.flatMap((l) => l.poly).map((q) => q.y), lm.jawY) - 0.04 * H);
  }
  const ties: HairGeometry['ties'] = [];
  for (const T of spots) {
    back.push(...(h.style === 'bun' ? bunLocks(ctx, T) : tailLocks(ctx, T)));
    ties.push(tieRing(ctx, T));
  }
  for (const b of braids) back.push(...braidLocks(ctx, b.at, b.sg));

  return {
    texture: tex, hairline: hl.pts, scalp, base: [base], bare: bareScalp(ctx), locks: [...back, ...front], backBase,
    front: [base, ...(fringe ? [fringe.base] : []), ...front.map((l) => l.poly)], back: [...(backBase ? [backBase] : []), ...back.map((l) => l.poly)],
    fringeBottom: fringe?.bottom ?? null, ties,
  };
}
