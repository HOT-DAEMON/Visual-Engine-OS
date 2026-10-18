import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { inPoly, type Poly } from '../poly';
import { lockFrom, type HairCtx } from './flow';
import type { HairLock, OcclusionInfo } from './types';

type Target = OcclusionInfo['target'];
type Box = OcclusionInfo['box'];

/**
 * Boîte (repère de l'hôte) de chaque composant enfant susceptible d'être recouvert. Elles viennent des REPÈRES du
 * visage (canthi, ligne des yeux, nez, bouche) : un composant ne « bouge » pas parce qu'une mèche passe devant.
 * Œil : du canthus interne jusqu'à 0,06 W du contour ; sourcils : bande au-dessus de l'œil, sous la limite des sourcils.
 */
export function targetBox(p: FaceParams, ctx: HairCtx, target: Target): Box {
  const { lm, guard } = ctx;
  const { H, W } = lm;
  if (target === 'nose') return { minX: (-p.nose.width * W) / 2, maxX: (p.nose.width * W) / 2, minY: lm.eyeY, maxY: lm.noseBaseY };
  if (target === 'mouth') return { minX: -lm.lips.half, maxX: lm.lips.half, minY: lm.lips.topY, maxY: lm.lips.bottomY };
  const sg = target === 'eyeRight' ? 1 : -1;
  const inner = (sg < 0 ? lm.innerCanthus.left : lm.innerCanthus.right).x;
  const outer = sg * (guard.hw(lm.eyeY) - 0.06 * W);
  const [minX, maxX] = [Math.min(inner, outer), Math.max(inner, outer)];
  if (target === 'brows') return { minX: -Math.abs(outer), maxX: Math.abs(outer), minY: lm.browLimitY, maxY: lm.eyeY - 0.06 * H };
  return { minX, maxX, minY: lm.eyeY - 0.07 * H, maxY: lm.eyeY + 0.045 * H };
}

/** Part (0–1) de la boîte couverte par l'union des polygones (grille 24 × 24). */
export function boxCoverage(polys: Poly[], b: Box): number {
  let n = 0;
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const x = b.minX + ((b.maxX - b.minX) * (i + 0.5)) / 24;
      const y = b.minY + ((b.maxY - b.minY) * (j + 0.5)) / 24;
      if (polys.some((q) => inPoly(q, x, y))) n++;
    }
  }
  return n / 576;
}

const quad = (a: Vec, c: Vec, b: Vec): Vec[] =>
  Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y };
  });

/**
 * Mèches qui PASSENT DEVANT le visage (calque `over`, dessiné après les yeux). Chaque cible demandée (`hair.occlusion`)
 * reçoit 1 mèche (2 au-delà de 60 %) qui part de la ligne d'implantation (elle est donc attachée à la chevelure),
 * traverse la boîte du composant, et dont la LARGEUR est ajustée par dichotomie jusqu'à ce que le recouvrement MESURÉ
 * (grille sur la vraie géométrie) égale le recouvrement demandé, à ±0,06 près. ≥ 0,95 = composant entièrement masqué.
 * La bouche est traversée de biais depuis le côté de la tête (une mèche longue rabattue en travers de la joue).
 */
export function occluders(ctx: HairCtx, p: FaceParams): { locks: HairLock[]; info: OcclusionInfo[] } {
  const { h, lm, hl, rnd } = ctx;
  const locks: HairLock[] = [];
  const info: OcclusionInfo[] = [];
  const targets: Target[] = ['eyeLeft', 'eyeRight', 'brows', 'nose', 'mouth'];
  for (const target of targets) {
    // La bouche ne peut être recouverte qu'à 60 % au plus (une seule mèche en travers de la joue) : valeur effective consignée.
    const want = Math.min(h.occlusion[target], target === 'mouth' ? 0.6 : 1);
    if (want < 0.02) continue;
    const box = targetBox(p, ctx, target);
    const xc = (box.minX + box.maxX) / 2;
    // Dimension de référence de la largeur de mèche : largeur de la boîte, sauf la bouche (mèche horizontale : sa hauteur).
    const bw = target === 'mouth' ? (box.maxY - box.minY) * 1.8 : box.maxX - box.minX;
    const n = want > 0.6 && target !== 'mouth' ? 2 : 1;
    const sway = (rnd() - 0.5) * 0.3 * bw;
    const build = (k: number): HairLock[] =>
      Array.from({ length: n }, (_, i) => {
        const off = n === 1 ? 0 : (i - 0.5) * 0.55 * (target === "mouth" ? 0 : bw) * Math.min(1, k);
        const sg = Math.sign(xc || 1);
        const R = target === 'mouth' ? { x: sg * lm.W * 0.46, y: lm.eyeY + 0.1 * lm.H } : { x: xc + off + sway, y: hl.yAt(xc + off) - 0.01 * lm.H };
        const E = target === 'mouth' ? { x: -sg * lm.lips.half * 0.3, y: (box.minY + box.maxY) / 2 } : { x: xc + off, y: box.maxY + 0.012 * lm.H };
        const c = quad(R, { x: (R.x + E.x) / 2 + sway, y: (R.y + E.y) / 2 }, E);
        const w = Math.max(0.003 * lm.W, (want >= 0.95 ? 2.6 : k) * bw * 0.9) / (n === 2 ? 1.6 : 1);
        return lockFrom(ctx, c, { width: w, rank: 'main', tone: -0.1 - 0.2 * rnd(), layer: 'over', sharp: 0.2, raw: true, kind: 'occluder', ragged: h.tips.irregular })[0] as HairLock;
      });
    // Dichotomie sur l'échelle de largeur k ∈ [0,005 ; 3,2] (recouvrement croissant avec k) ; on garde l'essai le plus proche de la demande.
    let lo = 0.005;
    let hi = 3.2;
    let best = build(hi);
    let bestErr = Math.abs(boxCoverage(best.map((l) => l.poly), box) - want);
    for (let it = 0; it < 11 && want < 0.95; it++) {
      const mid = (lo + hi) / 2;
      const cur = build(mid);
      const cov = boxCoverage(cur.map((l) => l.poly), box);
      if (Math.abs(cov - want) < bestErr) {
        best = cur;
        bestErr = Math.abs(cov - want);
      }
      if (cov < want) lo = mid;
      else hi = mid;
    }
    locks.push(...best);
    info.push({ target, box, requested: want, measured: boxCoverage(best.map((l) => l.poly), box) });
  }
  return { locks, info };
}
