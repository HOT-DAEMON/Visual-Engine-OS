import { clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt, rightSamples } from '../outline';
import { noise1, smoothstep } from './noise';

const N = 64;

/** Ligne d'implantation : polyligne de la tempe gauche à la tempe droite, toujours au-dessus des sourcils. */
export interface Hairline {
  readonly pts: Vec[];
  /** Ordonnée de la ligne à l'abscisse x (bornée aux extrémités). */
  yAt(x: number): number;
  /** Point d'abscisse normalisée s ∈ [−1, 1]. */
  at(s: number): Vec;
}

/**
 * Implantation : forme (ronde, droite, pic de veuve, tempes), recul des tempes (golfes), irrégularité
 * (bruit lisse + encoches, différent à gauche et à droite). Ne descend jamais sous `browLimitY − 0,03 H`.
 */
export function buildHairline(p: FaceParams, lm: FaceLandmarks): Hairline {
  const h = p.hair;
  const { W, H, outline } = lm;
  const samples = rightSamples(outline);
  const hw = (y: number): number => halfWidthAt(outline, y, samples);
  const yC = lm.hair.centerY;
  const yEnd = Math.max(-H / 2 + 0.05 * H, lm.hair.templeY - h.recession * 0.05 * H);
  const xEnd = hw(yEnd) * 0.97;
  const low = lm.browLimitY - 0.03 * H;
  const high = -H / 2 + 0.035 * H;
  const nzL = noise1(h.seed ^ 0xa11e);
  const nzR = noise1(h.seed ^ 0x51ed);
  const partX = h.part * 0.1 * W;
  const rnd = mulberry32(h.seed ^ 0x77);
  const notches = Array.from({ length: Math.floor(rnd() * (1 + 2 * h.irregularity)) }, () => ({ c: -0.8 + 1.6 * rnd(), w: 0.05 + 0.06 * rnd(), d: (0.4 + 0.6 * rnd()) * h.irregularity * 0.025 * H }));
  const pts: Vec[] = Array.from({ length: N + 1 }, (_, i) => {
    const s = -1 + (2 * i) / N;
    const x = s * xEnd;
    const a = Math.abs(s);
    const round = yC + (yEnd - yC) * a ** 2.2;
    let y = round;
    if (h.hairlineShape === 'straight') {
      const ym = yC + (yEnd - yC) * 0.45;
      y = ym + (yEnd - ym) * a ** 5;
    } else if (h.hairlineShape === 'widow') {
      y = round + 0.075 * H * (1 - Math.min(1, Math.abs(x - partX) / (xEnd * 0.55))) ** 2.5;
    } else if (h.hairlineShape === 'receding') {
      y = round - 0.02 * H * smoothstep(clamp((a - 0.35) / 0.65, 0, 1)) + 0.03 * H * (1 - a) ** 2;
    }
    y -= h.recession * 0.12 * H * Math.exp(-(((a - 0.78) / 0.17) ** 2));
    y += h.irregularity * 0.014 * H * (s < 0 ? nzL : nzR)(a * 8 + 3);
    for (const q of notches) y -= q.d * Math.exp(-(((s - q.c) / q.w) ** 2));
    return { x, y: clamp(y, high, low) };
  });
  const at = (s: number): Vec => {
    const f = clamp((s + 1) / 2, 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(f));
    const a = pts[i] as Vec;
    const b = pts[i + 1] as Vec;
    return { x: a.x + (b.x - a.x) * (f - i), y: a.y + (b.y - a.y) * (f - i) };
  };
  const yAt = (x: number): number => at(clamp(x / xEnd, -1, 1)).y;
  return { pts, at, yAt };
}

/** Arc du crâne, du bas du côté gauche au bas du côté droit, au-dessus de la ligne d'implantation. */
export function skullArc(lm: FaceLandmarks, hl: Hairline): Vec[] {
  const s = rightSamples(lm.outline);
  const side = (y: number): Vec[] => [...s.filter((q) => q.y <= y), { x: halfWidthAt(lm.outline, y, s), y }];
  const R = side((hl.pts[N] as Vec).y);
  const L = side((hl.pts[0] as Vec).y).map((q) => ({ x: -q.x, y: q.y }));
  return [...L.reverse(), ...R.slice(1)];
}

/** Point de l'arc à l'abscisse normalisée s ∈ [−1, 1] (paramétrage par indice). */
export function arcAt(arc: Vec[], s: number): Vec {
  const f = clamp((s + 1) / 2, 0, 1) * (arc.length - 1);
  const i = Math.min(arc.length - 2, Math.floor(f));
  const a = arc[i] as Vec;
  const b = arc[i + 1] as Vec;
  return { x: a.x + (b.x - a.x) * (f - i), y: a.y + (b.y - a.y) * (f - i) };
}
