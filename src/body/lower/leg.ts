import { mk } from '../atom';
import { add, limbPoly, lerp, mul, norm, perp, rotV, spindle, sub, v, type Station } from '../shape';
import type { Atom, Level, V } from '../types';
import { LEG_KIN, LEG_LANDMARKS, LEG_MUSCLES } from './leg-spec';
import type { FootFrame } from './foot';
import type { LegFrame } from './frame';
import type { LegParams } from './types';

export interface LegResult { readonly atoms: Atom[]; readonly foot: FootFrame; readonly knee: V; readonly ankle: V }
const dot = (c: V, rad: number, k = 6): V[] => Array.from({ length: k }, (_, i) => v(c.x + rad * Math.cos((2 * Math.PI * i) / k), c.y + rad * Math.sin((2 * Math.PI * i) / k)));

/** Cinématique directe plane d'UNE jambe + enveloppes + muscles + repères osseux du genou et de la cheville. */
export function legChain(lf: LegFrame, p: LegParams, side: 'L' | 'R'): LegResult {
  const s: 1 | -1 = side === 'L' ? 1 : -1, pose = side === 'L' ? p.pose.left : p.pose.right, { w, len, y: Y } = lf, h = lf.body.h, vis = lf.body.vis;
  const al = (pose.abduction * Math.PI) / 180, d0 = v(s * Math.sin(al), Math.cos(al)), n0 = v(s * Math.cos(al), -Math.sin(al));
  const lift = LEG_KIN.lift * h, T0 = v(s * lf.axisX, Y.crotch - lift), C0 = add(T0, mul(d0, lift)), K = add(C0, mul(d0, len.thigh));
  const fc = Math.max(LEG_KIN.minFlexCos, Math.cos((pose.kneeFlex * Math.PI) / 180)), inward = s * LEG_KIN.inward * pose.abduction;
  const d1 = rotV(d0, inward), n1 = rotV(n0, inward), A = add(K, mul(d1, len.shin * fc));
  const L1 = lift + len.thigh, tc = lift / L1, at = (rr: number): number => tc + (1 - tc) * rr;
  const ST_T: Station[] = [{ t: 0, lat: w.top, med: w.top - 0.012 * h }, { t: tc, lat: w.top * 0.97, med: w.top * 0.9 }, { t: at(0.45), lat: w.mid * (1.02 + 0.12 * lf.body.vis), med: w.mid * 0.98 }, { t: at(0.85), lat: lerp(w.mid, w.knee, 0.7), med: lerp(w.mid, w.knee, 0.7) }, { t: 1, lat: w.knee, med: w.knee * 0.97 }];
  const ST_S: Station[] = [{ t: 0, lat: w.knee, med: w.knee * 0.97 }, { t: 0.12, lat: w.knee * 0.93, med: w.knee * 0.92 }, { t: 0.3, lat: w.calf * 0.98, med: w.calf * 1.05 }, { t: 0.5, lat: w.calf * 0.9, med: w.calf * 0.92 }, { t: 0.8, lat: lerp(w.ankle, w.calf, 0.3), med: lerp(w.ankle, w.calf, 0.3) }, { t: 1, lat: w.ankle, med: w.ankle }];
  const part = (n: string): string => `${n}.${side}`, out: Atom[] = [];
  out.push(mk(part('leg.thigh'), 'skin', part('thigh'), 'pelvis.shell', 0, limbPoly(T0, K, n0, ST_T, 0, 0.25), { side, z: 5 }));
  out.push(mk(part('leg.shin'), 'skin', part('shin'), part('leg.thigh'), 0, limbPoly(K, A, n1, ST_S, 0.1, 0.1), { side, z: 6 }));
  const seg = { u: { a: C0, b: K, n: n0, w: w.mid }, s: { a: K, b: A, n: n1, w: w.calf } };
  for (const q of LEG_MUSCLES) {
    const g = seg[q.seg], k = g.w, wd = q.w * k * (0.85 + 0.25 * vis);
    let poly: V[];
    if (q.from && q.to) {
      const a2 = add(add(g.a, mul(sub(g.b, g.a), q.from[0])), mul(g.n, q.from[1] * k)), b2 = add(add(g.a, mul(sub(g.b, g.a), q.to[0])), mul(g.n, q.to[1] * k));
      poly = spindle(a2, b2, perp(norm(sub(b2, a2))), 0, 1, 0, wd, q.belly);
    } else poly = spindle(g.a, g.b, g.n, q.t0, q.t1, q.off * k, wd, q.belly);
    out.push(mk(part(q.id), 'muscle', part(q.seg === 'u' ? 'thigh' : 'shin'), part(q.parent), q.level, poly, { side, z: 110 + q.level * 10, tone: q.tone, ...(q.show === 'never' ? { view: 'occluded' as const } : {}) }));
  }
  const bone = (id: string, a: V, b: V, nn: V, wd: number, pa: string, vw: 'front' | 'occluded'): void => { out.push(mk(part(id), 'bone', part(pa === 'leg.thigh' ? 'thigh' : 'shin'), part(pa), 2, spindle(a, b, nn, 0, 1, 0, wd, 0.5, 0.5), { side, view: vw, z: 100 })); };
  bone('bone.femur', T0, K, n0, 0.1 * h, 'leg.thigh', 'occluded');
  bone('bone.tibia', K, A, n1, 0.06 * h, 'leg.shin', 'occluded');
  bone('bone.fibula', add(K, mul(n1, w.knee * 0.6)), add(A, mul(n1, w.ankle * 0.9)), n1, 0.025 * h, 'leg.shin', 'occluded');
  const ex = (rx: number, ry: number, c: V): V[] => Array.from({ length: 8 }, (_, i) => v(c.x + rx * Math.cos((Math.PI * i) / 4), c.y + ry * Math.sin((Math.PI * i) / 4)));
  const sh = (n: string, pa: string, lvl: Level, po: V[], kind: 'landmark' | 'bone' | 'fat', extra = {}): void => { out.push(mk(part(n), kind, part(pa.startsWith('leg.thigh') || pa === 'quadriceps' ? 'thigh' : 'shin'), part(pa), lvl, po, { side, ...extra })); };
  // Repères osseux : lus dans `LEG_LANDMARKS` (même table que la 3D). Centre = ancrage + normale × lat × demi-largeur + axe × along × h.
  const anc = { K, A }, dirs = [d0, d1] as const, nrm = [n0, n1] as const, wref = { K: w.knee, A: w.ankle };
  const L = (id: string): { q: (typeof LEG_LANDMARKS)[number]; c: V } => { const q = LEG_LANDMARKS.find((e) => e.id === id) as (typeof LEG_LANDMARKS)[number]; return { q, c: add(add(anc[q.at], mul(nrm[q.n], q.lat * wref[q.at])), mul(dirs[q.dir], q.along * h)) }; };
  const lmDot = (id: string): void => { const { q, c } = L(id); sh(id, q.parent, q.level, dot(c, q.rad * h), q.kind); };
  { const { q, c } = L('knee.patella'); sh(q.id, q.parent, q.level, ex((q.rx as number) * h, (q.ry as number) * h, c), q.kind, { z: q.z }); }
  lmDot('knee.condyle.lateral');
  lmDot('knee.condyle.medial');
  lmDot('knee.tibial-tuberosity');
  lmDot('knee.fibula-head');
  sh('knee.fat-pad', 'leg.shin', 3, [add(K, mul(d1, 0.02 * h)), add(add(K, mul(n1, w.knee * 0.35)), mul(d1, 0.07 * h)), add(sub(K, mul(n1, w.knee * 0.35)), mul(d1, 0.07 * h))], 'fat', { tone: -0.2 });
  const ln = (n: string, pa: string, pts: V[], extra = {}): void => { out.push(mk(part(n), 'line', part(pa === 'leg.shin' ? 'shin' : 'thigh'), part(pa), 3, pts, { side, open: true, ...extra })); };
  ln('knee.joint-line', 'leg.thigh', [add(K, mul(n0, w.knee * 0.8)), add(K, mul(d0, 0.012 * h)), sub(K, mul(n0, w.knee * 0.82))]);
  ln('knee.quadriceps-tendon', 'leg.thigh', [add(K, mul(d0, -0.16 * h)), add(K, mul(d0, -0.095 * h))]);
  ln('knee.patellar-ligament', 'leg.shin', [add(K, mul(d0, -0.01 * h)), add(K, mul(d1, 0.085 * h))]);
  ln('shin.tibial-crest', 'leg.shin', [add(add(K, mul(d1, 0.09 * h)), mul(n1, -0.1 * w.calf)), sub(add(A, mul(n1, -0.05 * w.calf)), mul(d1, 0.05 * h))]);
  ln('ankle.crease', 'leg.shin', [sub(A, mul(n1, w.ankle * 0.95)), add(A, mul(d1, 0.012 * h)), add(A, mul(n1, w.ankle * 0.95))]);
  ln('ankle.extensor-retinaculum', 'leg.shin', [sub(sub(A, mul(d1, 0.05 * h)), mul(n1, w.ankle * 0.9)), sub(A, mul(d1, 0.04 * h)), add(sub(A, mul(d1, 0.05 * h)), mul(n1, w.ankle * 0.9))]);
  lmDot('ankle.malleolus.medial');
  lmDot('ankle.malleolus.lateral');
  const dF = v(s * Math.sin((pose.footTurnout * Math.PI) / 180), Math.cos((pose.footTurnout * Math.PI) / 180)), nF = v(s * Math.cos((pose.footTurnout * Math.PI) / 180), -Math.sin((pose.footTurnout * Math.PI) / 180));
  return { atoms: out, foot: { o: A, d: dF, n: nF, side, s, pose }, knee: K, ankle: A };
}
