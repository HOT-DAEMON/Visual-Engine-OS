import { clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import { orient, type Poly } from '../poly';
import { lockFrom, type HairCtx } from './flow';
import { pieceCtx, splitByAspect } from './fringe-split';
import type { HairLock } from './types';

/** Feston arrondi (0 aux jonctions, 1 au milieu de la mèche) : un bord de frange est une suite de mèches à bout rond, pas une scie à dents triangulaires. */
const tri = (u: number): number => 0.5 - 0.5 * Math.cos(2 * Math.PI * (u - Math.floor(u)));

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
  const teeth = 6 + Math.floor(rnd() * 4);
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
  // TOUFFES INÉGALES (`docs/HAIR-FORM-FRINGE.md`) : avant, K mèches de MÊME largeur à pas quasi régulier : un peigne (largeur : CV 0,00, pas : CV 0,18 mesurés). Maintenant :
  // pas tirés au hasard (gamma-like), largeur ∝ pas local avec des mèches fines et des touffes larges, pointes plus ou moins effilées, quelques mèches isolées plus longues.
  // Tirage PROPRE (`fr`) : le nombre d'appels à `rnd` reste celui d'avant, le reste de la chevelure est inchangé.
  const fr = mulberry32(((h.seed ^ 0xf21e) * 2654435761) >>> 0);
  const gaps = Array.from({ length: K - 1 }, () => 0.45 + 2.6 * fr() * fr());
  const gsum = gaps.reduce((a, b) => a + b, 0);
  let acc = 0;
  const roots = [-xF, ...gaps.map((g) => (acc += g, -xF + (2 * xF * acc) / gsum))];
  // TOUFFES (`docs/HAIR-FRINGE-CLUMPS.md`) : les mèches voisines se regroupent par 2 à 4 ; chaque touffe converge vers une pointe commune (abscisse et longueur de sa première mèche, tirage propre)
  // et ondule en S d'une amplitude qui lui est propre. Avant : 14 à 22 rubans verticaux parallèles, de longueurs indépendantes : un PEIGNE (`HAIR-ROUND-REMAINING.md` 6).
  const clump: number[] = [];
  for (let n = 0, c = 0; n < K; c++) for (let j = 2 + Math.floor(fr() * 3); j > 0 && n < K; j--, n++) clump.push(c);
  const nC = (clump[K - 1] as number) + 1;
  const wave = Array.from({ length: nC }, () => ({ amp: (fr() < 0.5 ? -1 : 1) * (0.008 + 0.022 * fr()) * W, ph: fr() * 6.283 }));
  const tipX: number[] = [], tipY: number[] = [];
  for (let i = 0; i < K; i++) {
    rnd(); // (tirage historique de la jigue de la racine, conservé : même consommation de `rnd`)
    const x = roots[i] as number;
    const a = x / xF;
    const drift = h.fringe === 'sweep' ? sp * 0.05 * W * (0.5 + rnd()) : h.fringe === 'curtain' ? Math.sign(a || 1) * 0.06 * W * Math.abs(a) : (rnd() - 0.5) * 0.02 * W;
    let xe = clamp(x + drift, -xF, xF);
    const R = { x, y: hl.yAt(x) - 0.012 * H };
    const stray = fr() < 0.12 ? 1 + 1.6 * fr() : 1;
    let ye = Math.min(yF, bottomAt(xe, (depth[Math.floor(rnd() * teeth)] as number) * rnd()) + (stray - 1) * 0.5 * d);
    // Pointe commune de la touffe : la première mèche la fixe, les suivantes s'en rapprochent (pas les mèches isolées).
    const cid = clump[i] as number;
    if (tipX[cid] === undefined) { tipX[cid] = xe; tipY[cid] = ye; }
    else if (stray === 1) { xe = clamp(xe + 0.6 * ((tipX[cid] as number) - xe), -xF, xF); ye = Math.min(yF, Math.max(hl.yAt(xe) + 0.004 * H, ye + 0.5 * ((tipY[cid] as number) - ye))); }
    const E = { x: xe, y: ye };
    const C = { x: x + drift * 0.2, y: R.y + 0.6 * (E.y - R.y) };
    const wv = wave[cid] as { amp: number; ph: number }, reach = clamp((E.y - R.y) / (0.1 * H), 0.3, 1);
    const centre = Array.from({ length: 9 }, (_, j) => {
      const t = j / 8;
      // Ondulation en S (nulle à la racine et à la pointe) : la touffe n'est plus une droite.
      const s = Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * t * 0.9 + wv.ph) * wv.amp * reach;
      return { x: (1 - t) ** 2 * R.x + 2 * (1 - t) * t * C.x + t * t * E.x + s, y: (1 - t) ** 2 * R.y + 2 * (1 - t) * t * C.y + t * t * E.y };
    });
    const space = (((roots[i + 1] ?? xF + (xF - (roots[i - 1] ?? -xF)) / 2) - (roots[i - 1] ?? -xF - 0)) / 2) || (2 * xF) / K;
    const wmul = (1.5 + 1.1 * fr()) * (fr() < 0.25 ? 0.5 : fr() < 0.2 ? 1.5 : 1) * (stray > 1 ? 0.55 : 1);
    const width = Math.max(0.006 * W, Math.abs(space) * wmul);
    const tone = -(0.05 + 0.3 * rnd()) * h.highlight;
    const sharp = 0.15 + 0.35 * fr();
    splitByAspect(centre, width).forEach((pc, k) => locks.push(...lockFrom(pieceCtx(ctx, i, k), pc.centre, { width: pc.width, rank: 'main', tone, layer: 'front', sharp, mode: 'fringe', reach: 'cranial' }).map((l): HairLock => ({ ...l, bang: true }))));
  }
  return { locks, base, bottom };
}
