import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { classicLocks } from './classic';
import { buildFringe } from './fringe';
import { engineFringe } from './fringe2';
import { capTo, growLock, STYLES, type HairCtx } from './flow';
import { makeGuard } from './guard';
import { arcAt, buildHairline, skullArc } from './hairline';
import { hairlineStrands, massLocks, tierMasses } from './layers';
import { lockFrom } from './flow';
import { noise1 } from './noise';
import { occluders } from './occlusion';
import { bareScalp, capBase, envelope } from './scalp';
import { coneLocks, flowLocks, wispLocks } from './shapes';
import { applySides } from './sides';
import { braidLocks, braidRoots, bunLocks, tailLocks, tieRing, tieSpots } from './tie';
import { resolveTexture, textureSpec } from './texture';
import type { HairGeometry, HairLock } from './types';
import { makeGain, makeLift, puffWidth } from './volume';

export type { HairGeometry, HairLock, LockRank, LockKind, BareScalp, TierMass, OcclusionInfo, SideInfo } from './types';

/**
 * Chevelure complète d'un visage — GÉOMÉTRIE PURE (sans SVG) lue par le rendu ET par la couche de vérification.
 * Pipeline : implantation réelle → sous-couche (volume, gonflement, asymétrie, bosse à la raie) → frange (classique
 * ou moteur v2) → mèches moyennes/fines (étagées, textures mélangées) → grosses masses → grandes mèches en S, cônes,
 * volutes → poils très fins → mèches arrière / queue / chignon / tresses → comportement de CHAQUE côté (oreilles,
 * joues) → mèches qui passent devant le visage (occlusions) → sous-couches d'étage. `null` si chauve.
 */
export function hairGeometry(p: FaceParams, lm: FaceLandmarks): HairGeometry | null {
  const h = p.hair;
  if (h.style === 'bald') return null;
  const { W, H } = lm;
  const hl = buildHairline(p, lm);
  const arc = skullArc(lm, hl);
  const tex = resolveTexture(h.style, h.texture);
  const nz = noise1(h.seed ^ 0x5a5a);
  const partX = h.part * 0.1 * W;
  const ctx: HairCtx = {
    h, lm, hl, arc, guard: makeGuard(p, lm, hl), rnd: mulberry32(h.seed), nz, tex, spec: textureSpec(tex, h.curl, W, H), def: STYLES[h.style],
    C: { x: 0, y: h.style === 'spiky' ? lm.eyeY : lm.hair.sideY }, partX,
    gain: makeGain(h.silhouette, nz), puffW: puffWidth(h.silhouette.puff), lift: makeLift(h, partX, W),
  };
  const { rnd, def } = ctx;
  const { base, scalp } = capBase(ctx);
  const spots = h.style === 'ponytail' || h.style === 'bun' ? tieSpots(ctx) : [];
  const braids = h.style === 'braids' ? braidRoots(ctx) : [];
  const yHang = (): number => (h.style === 'long' ? H / 2 + (0.08 + 0.3 * h.length) * H : lm.jawY + (0.03 + 0.1 * h.length) * H) + (rnd() - 0.5) * h.lengthVariance * 0.18 * H;

  // Frange : moteur v2 si demandé, sinon la frange classique (masse pleine + dents).
  const eng = engineFringe(ctx);
  const classic = eng ? null : buildFringe(ctx);
  const fringeLocks = eng?.locks ?? classic?.locks ?? [];
  const fringeBottom = eng?.bottom ?? classic?.bottom ?? null;

  const grow = (R: Vec): Vec[] => (def.hang ? growLock(ctx, R, 2.2 * H, { yEnd: yHang() }) : growLock(ctx, R, 0.3 * H));
  let front: HairLock[] = [...classicLocks(ctx, { spots, braids, yHang }), ...massLocks(ctx, grow)];
  front.push(...flowLocks(ctx), ...coneLocks(ctx), ...wispLocks(ctx));
  front.push(...hairlineStrands(ctx, front), ...fringeLocks);

  let back: HairLock[] = [];
  let backBase = null as HairGeometry['backBase'];
  if (def.hang) {
    const braided = tex === 'braided';
    const nMain = Math.round((braided ? 9 : 16) + (braided ? 8 : 26) * h.density);
    for (let i = 0; i < Math.round(nMain * 0.8); i++) {
      const R = arcAt(arc, -1 + 2 * rnd());
      back.push(...lockFrom(ctx, growLock(ctx, R, 2.2 * H, { yEnd: yHang() }), { width: (def.mainW[0] + def.mainW[1] * h.volume) * W, rank: 'main', tone: -0.25 - 0.2 * rnd(), layer: 'back' }));
    }
    backBase = envelope([...front, ...back].flatMap((l) => l.poly).filter((q) => q.y >= lm.hair.sideY), lm.hair.sideY, back.flatMap((l) => l.poly).reduce((a, q) => Math.max(a, q.y), lm.jawY) - 0.04 * H);
  }
  const ties: HairGeometry['ties'] = [];
  for (const T of spots) {
    back.push(...(h.style === 'bun' ? bunLocks(ctx, T) : tailLocks(ctx, T)));
    ties.push(tieRing(ctx, T));
  }
  for (const b of braids) back.push(...braidLocks(ctx, b.at, b.sg));
  // Locks 'flow'/'wisp' tirées derrière (layer back) par les formes v2 sont rangées avec les mèches arrière.
  back = [...back, ...front.filter((l) => l.layer === 'back')];
  front = front.filter((l) => l.layer === 'front');

  const sides = applySides(ctx, p, front, back);
  const occ = occluders(ctx, p);
  const masses = tierMasses(ctx, sides.front);
  const all = [...sides.back, ...sides.front, ...occ.locks];
  return {
    texture: tex, hairline: hl.pts, scalp, base: [base], bare: bareScalp(ctx), locks: all, backBase,
    front: [base, ...(classic ? [classic.base] : []), ...sides.front.map((l) => l.poly)], back: [...(backBase ? [backBase] : []), ...sides.back.map((l) => l.poly)],
    fringeBottom, ties, over: occ.locks.map((l) => l.poly), tierMasses: masses, occlusions: occ.info, sides: sides.info,
  };
}

export { capTo };
