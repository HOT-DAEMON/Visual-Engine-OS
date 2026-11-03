import { mk } from '../atom';
import { add, mul } from '../shape';
import type { Atom, V } from '../types';
import type { LegFrame } from './frame';
import type { LegParams, LegPose } from './types';

/** Repère du pied, produit par la jambe (parent) et consommé ici : c'est TOUT ce que le pied sait de la jambe. */
export interface FootFrame { readonly o: V; readonly d: V; readonly n: V; readonly side: 'L' | 'R'; readonly s: 1 | -1; readonly pose: LegPose }
/** Demi-largeurs relatives des 5 orteils (× demi-largeur du pied), longueurs visibles relatives (× hauteur cheville→sol). CONVENTIONS d'atelier. */
export const TOE_W = [0.28, 0.2, 0.18, 0.16, 0.14];
export const TOE_L = [0.4, 0.34, 0.31, 0.28, 0.24];
export const TOE_SEGS: ReadonlyArray<readonly string[]> = [['prox', 'dist'], ['prox', 'mid', 'dist'], ['prox', 'mid', 'dist'], ['prox', 'mid', 'dist'], ['prox', 'mid', 'dist']];
export const TOE_NAMES = ['hallux', 'toe2', 'toe3', 'toe4', 'toe5'] as const;

/** Disposition des orteils (SOURCE UNIQUE, lue par le pied 2D et le pied 3D) : abscisses `cs` des centres, demi-largeurs `tw`, longueurs `ln` (déjà modulées par `toes[k]` et la flexion), éventail `fan`. Unités : px de l'hôte ; `v0` = départ des orteils (cheville → sol). */
export interface ToeLayout { readonly cs: readonly number[]; readonly tw: readonly number[]; readonly ln: readonly number[]; readonly fan: readonly number[]; readonly v0: number; readonly fs: number }
export function toeLayout(lf: LegFrame, p: LegParams, pose: LegPose): ToeLayout {
  const vt = lf.len.ankleH, fw = lf.w.foot, h = lf.body.h, fs = lf.len.foot / (lf.lc.footLen * h);
  const tw = TOE_W.map((k) => k * fw), gap = 0.008 * h + pose.toeSpread * 0.02 * h, cs: number[] = [-fw + (tw[0] as number)];
  for (let k = 1; k < 5; k++) cs.push((cs[k - 1] as number) + (tw[k - 1] as number) + (tw[k] as number) + gap);
  const ln = TOE_L.map((l, k) => vt * l * (1 + 0.15 * (p.toes[k] as number)) * fs * (1 - 0.5 * pose.toeCurl)), fan = TOE_L.map((_, k) => (k - 1.5) * pose.toeSpread * 0.012 * h);
  return { cs, tw, ln, fan, v0: 0.78 * vt, fs };
}

/**
 * Pied vu de face (dos du pied), repère local (U en travers, + = côté latéral ; V vers le sol) projeté par la rotation `footTurnout` : la
 * longueur du pied est vue en raccourci (le pied pointe vers le spectateur) ; seule la hauteur cheville → sol et la largeur sont lisibles.
 * Orteils : gros orteil 2 phalanges, autres 3 ; ongles ; métatarsiens, naviculaire et tendons extenseurs.
 */
export function footAtoms(lf: LegFrame, p: LegParams, ff: FootFrame): Atom[] {
  const { side, pose } = ff, vt = lf.len.ankleH, a = lf.w.ankle, fw = lf.w.foot, h = lf.body.h;
  const T = (u: number, y: number): V => add(add(ff.o, mul(ff.d, y)), mul(ff.n, u));
  const id = (n: string): string => `${n}.${side}`;
  const out: Atom[] = [];
  const dors = [[-a, -0.06 * vt], [a, -0.06 * vt], [a * 1.25, 0.3 * vt], [fw * 0.9, 0.62 * vt], [fw, 0.82 * vt], [-fw * 0.95, 0.82 * vt], [-fw * 0.82, 0.62 * vt], [-a * 1.2, 0.3 * vt]] as const;
  out.push(mk(id('foot.dorsum'), 'skin', id('foot'), id('leg.shin'), 0, dors.map(([u, y]) => T(u, y)), { side, z: 7 }));
  const { tw, cs, ln: lns, fan: fans, v0 } = toeLayout(lf, p, pose);
  for (let k = 0; k < 5; k++) {
    const c = cs[k] as number, w = tw[k] as number;
    const ln = lns[k] as number, v1 = v0 + ln, fan = fans[k] as number;
    const cap = (inset: number, a0: number, a1: number): V[] => [T(c - w + inset, a0), T(c - w * 1.04 + inset, (a0 + a1) / 2), T(c - w * 0.78 + fan, a1 - 0.18 * w), T(c + fan, a1), T(c + w * 0.78 + fan, a1 - 0.18 * w), T(c + w * 1.04 - inset, (a0 + a1) / 2), T(c + w - inset, a0)];
    out.push(mk(id(`foot.toe.${k + 1}`), 'skin', id('foot'), id('foot.dorsum'), 1, cap(0, v0, v1), { side, z: 8, tone: -0.02 }));
    const segs = TOE_SEGS[k] as readonly string[], n = segs.length;
    segs.forEach((sg, i) => {
      const a0 = v0 + (ln * i) / n, a1 = v0 + (ln * (i + 1)) / n - 0.004 * h, cw = w * (0.55 - 0.08 * i);
      out.push(mk(id(`toe.${TOE_NAMES[k]}.${sg}`), 'bone', id('foot'), id(`foot.toe.${k + 1}`), 2, [T(c - cw, a0), T(c + cw, a0), T(c + cw * 0.9 + fan * 0.5, a1), T(c - cw * 0.9 + fan * 0.5, a1)], { side, view: 'occluded' }));
    });
    const nw = w * (k === 0 ? 0.62 : 0.55), nv = v0 + ln * (k === 0 ? 0.55 : 0.5);
    out.push(mk(id(`toe.${TOE_NAMES[k]}.nail`), 'nail', id('foot'), id(`foot.toe.${k + 1}`), 3, [T(c - nw, nv), T(c + nw, nv), T(c + nw * 0.85 + fan * 0.7, v1 - 0.18 * w), T(c - nw * 0.85 + fan * 0.7, v1 - 0.18 * w)], { side, z: 9 }));
  }
  // Métatarsiens (cachés), naviculaire et tendons extenseurs (lignes du dos du pied).
  for (let k = 0; k < 5; k++) { const c = (cs[k] as number) * 0.8, w = (tw[k] as number) * 0.4; out.push(mk(id(`foot.metatarsal.${k + 1}`), 'bone', id('foot'), id('foot.dorsum'), 2, [T(c - w, 0.3 * vt), T(c + w, 0.3 * vt), T(c + w * 1.2, 0.78 * vt), T(c - w * 1.2, 0.78 * vt)], { side, view: 'occluded' })); }
  out.push(mk(id('foot.navicular'), 'landmark', id('foot'), id('foot.dorsum'), 3, [T(-a * 1.1, 0.15 * vt), T(-a * 0.6, 0.1 * vt), T(-a * 0.6, 0.3 * vt), T(-a * 1.1, 0.32 * vt)], { side, z: 9 }));
  for (let k = 1; k < 5; k++) out.push(mk(id(`foot.tendon.${k}`), 'line', id('foot'), id('foot.dorsum'), 3, [T((cs[k] as number) * 0.5, 0.05 * vt), T((cs[k] as number) * 0.75, 0.4 * vt), T(cs[k] as number, 0.78 * vt)], { side, open: true }));
  return out;
}
