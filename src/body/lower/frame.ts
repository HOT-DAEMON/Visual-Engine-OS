import { Resolver, type Correction } from '../../core/resolve';
import type { BodyFrame } from '../frame';
import { lowerCanonAt, type LowerCanon } from './canon';
import type { LegParams } from './types';

/**
 * CADRE DU BAS DU CORPS : grandeurs en px, fonction pure de (cadre du haut, paramètres des jambes). Les relations qui doivent tenir
 * (cuisse plus large que le genou, mollet plus large que la cheville…) passent par le Résolveur : toute valeur ramenée est CONSIGNÉE.
 */
export interface LegFrame {
  readonly body: BodyFrame;
  readonly lc: LowerCanon;
  readonly y: { readonly crop: number; readonly crotch: number; readonly knee: number; readonly ankle: number; readonly sole: number };
  /** thigh = fourche → genou ; shin = genou → cheville (hors flexion) ; foot = longueur du pied ; ankleH = cheville → sol. */
  readonly len: { readonly thigh: number; readonly shin: number; readonly foot: number; readonly ankleH: number };
  /** Demi-largeurs (px) : haut de cuisse (dérivé de la hanche), mi-cuisse, genou, mollet, cheville, pied. */
  readonly w: { readonly top: number; readonly mid: number; readonly knee: number; readonly calf: number; readonly ankle: number; readonly foot: number };
  /** Abscisse (côté gauche, x > 0) de l'axe de la cuisse à la fourche. */
  readonly axisX: number;
  readonly corrections: readonly Correction[];
}
const dev = (k: number): number => 1 + 0.12 * k;
export function legFrame(f: BodyFrame, p: LegParams): LegFrame {
  const h = f.h, c = lowerCanonAt(f.age), R = new Resolver(), lb = p.limbs;
  const crotch = f.y.crop + (c.crotch - 1.3 * f.canon.torso) * h;
  const thigh = c.thigh * dev(lb.thigh) * h, shin = c.shin * dev(lb.shin) * h;
  const mid0 = c.thighMid * (1 + 0.42 * f.mus + 0.42 * f.fat - 0.05 * f.dim) * dev(lb.thighGirth) * h;
  const knee0 = c.knee * (1 + 0.08 * f.fat + 0.05 * f.mus) * dev(lb.kneeWidth) * h;
  const calf0 = c.calf * (1 + 0.34 * f.mus + 0.3 * f.fat) * dev(lb.calfGirth) * h;
  const ankle0 = c.ankle * (1 + 0.05 * f.mus + 0.1 * f.fat) * dev(lb.ankleThickness) * h;
  const knee = R.limit('knee-thinner-than-thigh', 'limbs.kneeWidth', knee0, 0.05 * h, mid0 / 1.05, 'le genou reste plus étroit que la mi-cuisse (≤ 1/1,05)');
  const mid = R.limit('thigh-wider-than-knee', 'limbs.thighGirth', mid0, knee * 1.05, Infinity, 'la mi-cuisse reste plus large que le genou');
  const ankle = R.limit('ankle-thinner-than-calf', 'limbs.ankleThickness', ankle0, 0.04 * h, calf0 / 1.3, 'la cheville reste plus fine que le mollet (≤ 1/1,3)');
  const calf = R.limit('calf-wider-than-ankle', 'limbs.calfGirth', calf0, ankle * 1.3, Infinity, 'le mollet reste plus large que la cheville');
  const top = f.x.hip * 0.5, y = { crop: f.y.crop, crotch, knee: crotch + thigh, ankle: crotch + thigh + shin, sole: crotch + thigh + shin + c.ankleH * h };
  return { body: f, lc: c, y, len: { thigh, shin, foot: c.footLen * dev(lb.foot) * h, ankleH: c.ankleH * h }, w: { top, mid, knee, calf, ankle, foot: c.footHalf * h * (1 + 0.08 * f.fat) }, axisX: f.x.hip * 0.52, corrections: R.applied };
}
