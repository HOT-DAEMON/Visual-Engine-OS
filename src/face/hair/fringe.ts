import { clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import { orient, type Poly } from '../poly';
import { lockFrom, type HairCtx } from './flow';
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
  for (let i = 0; i < K; i++) {
    rnd(); // (tirage historique de la jigue de la racine, conservé : même consommation de `rnd`)
    const x = roots[i] as number;
    const a = x / xF;
    const drift = h.fringe === 'sweep' ? sp * 0.05 * W * (0.5 + rnd()) : h.fringe === 'curtain' ? Math.sign(a || 1) * 0.06 * W * Math.abs(a) : (rnd() - 0.5) * 0.02 * W;
    const xe = clamp(x + drift, -xF, xF);
    const R = { x, y: hl.yAt(x) - 0.012 * H };
    const stray = fr() < 0.12 ? 1 + 1.6 * fr() : 1;
    const E = { x: xe, y: Math.min(yF, bottomAt(xe, (depth[Math.floor(rnd() * teeth)] as number) * rnd()) + (stray - 1) * 0.5 * d) };
    const C = { x: x + drift * 0.2, y: R.y + 0.6 * (E.y - R.y) };
    const centre = Array.from({ length: 9 }, (_, j) => {
      const t = j / 8;
      return { x: (1 - t) ** 2 * R.x + 2 * (1 - t) * t * C.x + t * t * E.x, y: (1 - t) ** 2 * R.y + 2 * (1 - t) * t * C.y + t * t * E.y };
    });
    const space = (((roots[i + 1] ?? xF + (xF - (roots[i - 1] ?? -xF)) / 2) - (roots[i - 1] ?? -xF - 0)) / 2) || (2 * xF) / K;
    const wmul = (1.5 + 1.1 * fr()) * (fr() < 0.25 ? 0.5 : fr() < 0.2 ? 1.5 : 1) * (stray > 1 ? 0.55 : 1);
    locks.push(...lockFrom(ctx, centre, { width: Math.max(0.006 * W, Math.abs(space) * wmul), rank: 'main', tone: -(0.05 + 0.3 * rnd()) * h.highlight, layer: 'front', sharp: 0.15 + 0.35 * fr(), mode: 'fringe', reach: 'cranial' }).map((l): HairLock => ({ ...l, bang: true })));
  }
  return { locks, base, bottom };
}
