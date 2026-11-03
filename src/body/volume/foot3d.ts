import { TOE_NAMES, TOE_SEGS, toeLayout } from '../lower/foot';
import type { LegFrame } from '../lower/frame';
import type { LegParams } from '../lower/types';
import type { Ctl } from './loft';
import { vol } from './mk';
import type { LegSkel } from './legs-skeleton';
import type { Volume } from './types';
import { add3, mul3, type P3 } from './vec3';

/** Profil de la voûte : [abscisse (× L, 0 = cheville), demi-largeur (× demi-largeur du pied), haut (× cheville→sol), bas (× cheville→sol)]. CONVENTIONS d'atelier (planche ref-03). */
const FOOT: readonly (readonly [number, number, number, number])[] = [[-0.285, 0.1, 0.16, 0.02], [-0.27, 0.3, 0.42, 0.01], [-0.25, 0.44, 0.62, 0], [-0.19, 0.58, 0.86, 0], [-0.08, 0.58, 1.18, 0.02], [0.08, 0.74, 0.7, 0.1], [0.28, 0.88, 0.42, 0.1], [0.48, 1.0, 0.27, 0], [0.6, 0.96, 0.2, 0]];
const BASE = 0.6;

/**
 * PIED 3D : enveloppe de peau (dos du pied, talon, voûte), cinq orteils (peau niveau 1 + phalanges cachées + ongle), métatarsiens et calcanéus cachés,
 * naviculaire, tendons extenseurs. Orteils : MÊME disposition que le 2D (`toeLayout`) — abscisses, largeurs, longueurs, éventail, flexion. Les identifiants
 * reprennent ceux des atomes 2D (`foot.dorsum`, `foot.toe.k`, `toe.<nom>.<phalange>`, `toe.<nom>.nail`, `foot.metatarsal.k`, `foot.navicular`, `foot.tendon.k`).
 */
export function footVolumes(sk: LegSkel, lf: LegFrame, lp: LegParams): Volume[] {
  const sd = sk.sd, h = lf.body.h, L = lf.len.foot, H1 = lf.len.ankleH, fw = lf.w.foot, F = sk.foot, pose = sk.pose, out: Volume[] = [];
  const W = (l: number, u: number, f: number): P3 => add3(add3(add3(F.o, mul3(F.lat, l)), mul3(F.up, u)), mul3(F.fwd, f));
  const id = (n: string): string => `${n}.${sd}`;
  const lay = toeLayout(lf, lp, pose);
  const sec = (l: number, f: number, top: number, bot: number, a: number): Ctl => ({ c: W(l, (top + bot) / 2, f), a, b: Math.max(1e-3, (top - bot) / 2), hint: F.up });
  out.push(vol({ id: id('foot.dorsum'), name: 'pied (enveloppe : talon, voûte, dos)', group: 'foot', kind: 'skin', side: sd, parent: id('leg.env'), level: 0, layer: 1, tier: 0, mass: `leg.skin.${sd}`, n: 22 }, FOOT.map(([t, a, top, bot]) => sec(0, t * L, top * H1, bot * H1, a * fw))));
  // Calcanéus et métatarsiens : os cachés (présents dans les données, non dessinés).
  const hid = (k: string, name: string, c: readonly Ctl[]): void => { out.push(vol({ id: id(k), name, group: 'foot', kind: 'bone', side: sd, parent: id('foot.dorsum'), level: 2, layer: 2, hidden: true, n: 5 }, c)); };
  hid('foot.calcaneus', 'calcanéus', [sec(0, -0.24 * L, 0.3 * H1, 0.02 * H1, 0.3 * fw), sec(0, -0.1 * L, 0.5 * H1, 0.04 * H1, 0.36 * fw), sec(0, 0.1 * L, 0.3 * H1, 0.08 * H1, 0.3 * fw)]);
  const tipL = (k: number): number => (lay.cs[k] as number) + (lay.fan[k] as number);
  for (let k = 0; k < 5; k++) hid(`foot.metatarsal.${k + 1}`, `métatarsien ${k + 1}`, [sec((lay.cs[k] as number) * 0.8, 0.12 * L, 0.34 * H1, 0.14 * H1, (lay.tw[k] as number) * 0.4), sec(tipL(k) * 0.9, BASE * L, 0.2 * H1, 0.06 * H1, (lay.tw[k] as number) * 0.4)]);
  out.push(vol({ id: id('foot.navicular'), name: 'naviculaire', group: 'foot', kind: 'landmark', side: sd, parent: id('foot.dorsum'), level: 3, layer: 5, tone: 0.1, n: 3 }, [-1, 0, 1].map((i) => ({ c: W(-0.7 * fw, 0.42 * H1, 0.08 * L + i * 0.02 * h), a: 0.018 * h * (1 - 0.4 * Math.abs(i)), b: 0.012 * h, hint: F.up }))));
  // Tendons extenseurs : du cou-de-pied à la base de chaque orteil (brins minces).
  for (let k = 1; k < 5; k++) {
    const l = lay.cs[k] as number, pts = [[0.5 * l, -0.02 * L, 0.84 * H1], [0.7 * l, 0.2 * L, 0.46 * H1], [l, BASE * L, 0.21 * H1]] as const;
    out.push(vol({ id: id(`foot.tendon.${k}`), name: `tendon extenseur du pied ${k}`, group: 'foot', kind: 'tendon', side: sd, parent: id('foot.dorsum'), level: 3, layer: 6, tier: 4, tone: 0.22, strand: true, n: 5 }, pts.map(([l2, f, u]) => ({ c: W(l2, u + 0.004 * h, f), a: 0.0045 * h, b: 0.0045 * h, hint: F.up }))));
  }
  // Orteils : chemin par phalanges, flexion cumulée vers le sol (autour de l'axe latéral du pied), peau + phalanges cachées + ongle.
  for (let k = 0; k < 5; k++) {
    const nm = TOE_NAMES[k] as string, segs = TOE_SEGS[k] as readonly string[], n = segs.length, ln = lay.ln[k] as number, w = lay.tw[k] as number, bt = 0.85 * w;
    // Chemin : avance le long de l'avant du pied, éventail latéral proportionnel, flexion (toeCurl) qui abaisse la pointe vers le sol.
    const pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return add3(W((lay.cs[k] as number) + (lay.fan[k] as number) * t, bt, BASE * L + ln * t), mul3(F.up, -Math.sin(pose.toeCurl * 0.9 * t * t) * ln * 0.9)); });
    const skin: Ctl[] = pts.map((c, i) => ({ c, a: w * (i === 0 ? 0.95 : i === n ? 0.9 : 1), b: bt * (i === n ? 0.85 : 1), hint: F.up }));
    const tip = pts[n] as P3;
    skin.push({ c: add3(tip, mul3(F.fwd, 0.35 * w)), a: w * 0.62, b: bt * 0.55, hint: F.up }, { c: add3(tip, mul3(F.fwd, 0.6 * w)), a: w * 0.2, b: bt * 0.18, hint: F.up });
    out.push(vol({ id: id(`foot.toe.${k + 1}`), name: `orteil ${k + 1} (${nm})`, group: 'foot', kind: 'skin', side: sd, parent: id('foot.dorsum'), level: 1, layer: 1, tier: 0, tone: -0.02, n: 8 }, skin));
    segs.forEach((sg, i) => { const cw = w * (0.55 - 0.08 * i); out.push(vol({ id: id(`toe.${nm}.${sg}`), name: `phalange ${sg} (${nm})`, group: 'foot', kind: 'bone', side: sd, parent: id(`foot.toe.${k + 1}`), level: 2, layer: 2, hidden: true, n: 3 }, [pts[i] as P3, pts[i + 1] as P3].map((c) => ({ c, a: cw, b: cw, hint: F.up })))); });
    const nw = w * (k === 0 ? 0.62 : 0.55);
    out.push(vol({ id: id(`toe.${nm}.nail`), name: `${nm} — ongle`, group: 'foot', kind: 'landmark', side: sd, parent: id(`foot.toe.${k + 1}`), level: 3, layer: 7, tier: 0, tone: 0.4, n: 3 }, [0, 0.5, 1].map((t) => ({ c: add3(add3(add3(pts[n - 1] as P3, mul3(add3(tip, mul3(pts[n - 1] as P3, -1)), 0.3 + 0.55 * t)), mul3(F.up, bt * 0.95)), mul3(F.fwd, 0.1 * w * t)), a: nw * (t === 1 ? 0.85 : 1), b: 0.05 * w, hint: F.up }))));
  }
  return out;
}
