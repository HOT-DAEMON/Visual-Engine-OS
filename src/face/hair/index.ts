import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { classicLocks } from './classic';
import { buildFringe } from './fringe';
import { engineFringe } from './fringe2';
import { capTo, growLock, STYLES, type HairCtx } from './flow';
import { makeGuard } from './guard';
import { buildBoundary } from './boundary';
import { wingLocks } from './boundary/wings';
import { arcAt, skullArc } from './hairline';
import { hairlineStrands, massLocks, tierMasses } from './layers';
import { lockFrom } from './flow';
import { noise1 } from './noise';
import { occluders } from './occlusion';
import { bareScalp, capBase } from './scalp';
import { cranialLimit, fitReach, windReach } from './reach';
import { backMassShape } from './back-mass';
import { fillShell } from './crown-fill';
import { combLocks } from './comb';
import { inPoly } from '../poly';
import { isBodyLock } from './body-lock';
import { coneLocks, flowLocks, wispLocks } from './shapes';
import { applySides } from './sides';
import { braidLocks, braidRoots, bunLocks, tailLocks, tieRing, tieSpots } from './tie';
import { resolveTexture, textureSpec } from './texture';
import type { HairGeometry, HairLock } from './types';
import { simLocks } from './sim';
import { canonical, ContentCache } from '../../perf/content-cache';
import { clock } from '../../perf/clock';
import { makeGain, makeLift, puffWidth } from './volume';
import { boundGain, THICKNESS } from './thickness';
import { RIM, trimToRim } from './rim';
import { applyWind } from './wind';

export { buildBoundary, rootFrames, windDir, projectBoundary } from './boundary';
export type { HairBoundary, BoundaryPoint, EdgeKind, HairMarks, RootFrame } from './boundary';
export type { HairGeometry, HairLock, LockRank, LockKind, BareScalp, TierMass, OcclusionInfo, SideInfo } from './types';

/**
 * Chevelure complète d'un visage — GÉOMÉTRIE PURE (sans SVG) lue par le rendu ET par la couche de vérification.
 * Pipeline : implantation réelle → sous-couche (volume, gonflement, asymétrie, bosse à la raie) → frange (classique
 * ou moteur v2) → mèches moyennes/fines (étagées, textures mélangées) → grosses masses → grandes mèches en S, cônes,
 * volutes → poils très fins → mèches arrière / queue / chignon / tresses → comportement de CHAQUE côté (oreilles,
 * joues) → mèches qui passent devant le visage (occlusions) → sous-couches d'étage. `null` si chauve.
 */
function hairGeometryRaw(p: FaceParams, lm: FaceLandmarks): HairGeometry | null {
  const h = p.hair;
  if (h.style === 'bald') return null;
  const { W, H } = lm;
  const boundary = buildBoundary(p, lm);
  const hl = boundary.hairline;
  const arc = skullArc(lm, hl);
  const tex = resolveTexture(h.style, h.texture);
  const nz = noise1(h.seed ^ 0x5a5a);
  const partX = h.part * 0.1 * W;
  const ctx: HairCtx = {
    h, lm, hl, arc, guard: makeGuard(p, lm, hl), boundary, rnd: mulberry32(h.seed), nz, tex, spec: textureSpec(tex, h.curl, W, H), def: STYLES[h.style],
    C: { x: 0, y: h.style === 'spiky' ? lm.eyeY : lm.hair.sideY }, partX,
    gain: boundGain(makeGain(h.silhouette, nz), h.style), puffW: puffWidth(h.silhouette.puff) * THICKNESS[h.style].puff, lift: makeLift(h, partX, W),
  };
  const { rnd, def } = ctx;
  const { base, scalp, wings, crown } = capBase(ctx);
  const spots = !h.sim.enabled && (h.style === 'ponytail' || h.style === 'bun') ? tieSpots(ctx) : [];
  const braids = !h.sim.enabled && h.style === 'braids' ? braidRoots(ctx) : [];
  const yHang = (): number => (h.style === 'long' ? H / 2 + (0.08 + 0.3 * h.length) * H : lm.jawY + (0.03 + 0.1 * h.length) * H) + (rnd() - 0.5) * h.lengthVariance * 0.18 * H;

  // Frange : moteur v2 si demandé, sinon la frange classique (masse pleine + dents).
  const eng = engineFringe(ctx);
  const classic = eng ? null : buildFringe(ctx);
  const fringeLocks = eng?.locks ?? classic?.locks ?? [];
  const fringeBottom = eng?.bottom ?? classic?.bottom ?? null;

  const grow = (R: Vec): Vec[] => (def.hang ? growLock(ctx, R, 2.2 * H, { yEnd: yHang() }) : growLock(ctx, R, 0.3 * H));
  // Cheveux SIMULÉS (Verlet) : remplacent les générateurs dessinés à la main ; frange, côtés et occlusions restent actifs.
  const sim = h.sim.enabled ? simLocks(ctx) : null;
  let front: HairLock[] = sim ? [] : [...wingLocks(ctx, wings, crown), ...classicLocks(ctx, { spots, braids, yHang }), ...massLocks(ctx, grow)];
  if (!sim) {
    front.push(...flowLocks(ctx), ...coneLocks(ctx), ...wispLocks(ctx));
    front.push(...hairlineStrands(ctx, front), ...fringeLocks);
  } else front.push(...sim.locks.filter((l) => l.layer !== 'over'));

  let back: HairLock[] = [];
  if (def.hang && !sim) {
    const braided = tex === 'braided';
    const nMain = Math.round((braided ? 9 : 16) + (braided ? 8 : 26) * h.density);
    for (let i = 0; i < Math.round(nMain * 0.8); i++) {
      const R = arcAt(arc, -1 + 2 * rnd());
      // Le champ de flux peut recourber une mèche arrière par-dessus le sommet (0,20 H mesuré en bob) : montée et envol bornés par la coiffure.
      const wd = (def.mainW[0] + def.mainW[1] * h.volume) * W;
      back.push(...lockFrom(ctx, fitReach(ctx, growLock(ctx, R, 2.2 * H, { yEnd: yHang() }), wd / 2, 'cranial'), { width: wd, rank: 'main', tone: -0.25 - 0.2 * rnd(), layer: 'back', reach: 'cranial' }));
    }
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

  // Lisière des volumes (afro, bouclé) : les sommets qui dépassent la coque sont ramenés sur son contour (bord en masse, pas en dents de scie) — `rim.ts`.
  const rim = RIM[h.style as keyof typeof RIM];
  if (rim && !sim) front = trimToRim(base, boundary.skull, front, rim.margin * W, lm.browLimitY);

  const sides = applySides(ctx, p, front, back);
  // Masse arrière : posée sur le crâne, doublée par les mèches définitives (voir `back-mass.ts`). Coiffures pendantes classiques et archétypes simulés à masse.
  const backBase: HairGeometry['backBase'] = (def.hang && !sim) || sim?.backMass
    ? backMassShape({ lm, skull: boundary.skull, polys: [...sides.back, ...sides.front].filter(isBodyLock).map((l) => l.poly), backPolys: sides.back.filter(isBodyLock).map((l) => l.poly), crown })
    : null;
  const occ = occluders(ctx, p);
  const masses = tierMasses(ctx, sides.front);
  const simOver = sim ? sim.locks.filter((l) => l.layer === 'over') : [];
  // Remplissage de la coque : EN DERNIER (graine propre) — le reste de la chevelure est identique avec ou sans lui. Jamais sur une oreille dégagée.
  const fill = fillShell(ctx, base, sides.front).filter((l) => ['left', 'right'].every((s) => sides.info[s as 'left' | 'right'].ear === 'covered' || !l.poly.some((q) => inPoly(sides.info[s as 'left' | 'right'].earZone, q.x, q.y))));
  // Dôme des coiffures tirées / rase : stries et chaume (`comb.ts`), en dernier, graine propre.
  const comb = combLocks(ctx, base, spots);
  const all = [...sides.back, ...sides.front, ...fill, ...comb, ...occ.locks, ...simOver];
  const geo: HairGeometry = {
    texture: tex, hairline: hl.pts, boundary, scalp, base: [base], bare: bareScalp(ctx), locks: all, backBase,
    front: [base, ...(classic ? [classic.base] : []), ...sides.front.map((l) => l.poly), ...fill.map((l) => l.poly)], back: [...(backBase ? [backBase] : []), ...sides.back.map((l) => l.poly)],
    fringeBottom, ties, over: [...occ.locks, ...simOver].map((l) => l.poly), skinShadows: sim?.skinShadows ?? [], simMass: sim?.mass ?? null, shaved: sim?.shaved ?? [], tierMasses: masses, occlusions: occ.info, sides: sides.info,
  };
  // Vent (aucun par défaut : la même géométrie, sans copie) : mèches déplacées en levier autour de leur racine, sans jamais recouvrir la peau du visage.
  return applyWind(geo, h.wind, lm.H, windReach(h.style as Exclude<typeof h.style, 'bald'>, boundary.skull, lm.W, lm.H, cranialLimit(ctx), Math.hypot(h.wind.x, h.wind.y) * h.wind.flex));
}

/**
 * Géométrie des cheveux MÉMOÏSÉE par contenu : (paramètres du visage, W, H) → même résultat (fonction pure, graine de la chevelure
 * dans les paramètres). Un rendu l'appelle 3 fois (visibilité des oreilles, composants, cheveux) et la vérification 3 fois de plus ;
 * la simulation coûte ≈ 100 ms : les appels suivants ne coûtent que la sérialisation de la clé. Le résultat est IMMUABLE pour les appelants.
 */
const geoCache = new ContentCache<HairGeometry | 'bald'>('hairGeometry', 48);
export function hairGeometry(p: FaceParams, lm: FaceLandmarks): HairGeometry | null {
  const key = canonical([p, lm.W, lm.H]);
  const hit = geoCache.get(key);
  if (hit !== undefined) return hit === 'bald' ? null : hit;
  const g = clock.time('geometry', () => hairGeometryRaw(p, lm));
  geoCache.set(key, g ?? 'bald');
  return g;
}

export { capTo };
