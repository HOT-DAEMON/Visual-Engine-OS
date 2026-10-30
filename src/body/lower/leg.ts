import { mk } from '../atom';
import { add, limbPoly, lerp, mul, norm, perp, rotV, spindle, sub, v, type Station } from '../shape';
import type { Atom, Level, V } from '../types';
import type { FootFrame } from './foot';
import type { LegFrame } from './frame';
import type { LegParams } from './types';

interface Row { readonly id: string; readonly seg: 'u' | 's'; readonly t0: number; readonly t1: number; readonly off: number; readonly w: number; readonly belly: number; readonly level: Level; readonly parent: string; readonly tone: number; readonly show: 'always' | 'never'; readonly from?: readonly [number, number]; readonly to?: readonly [number, number] }
const r = (id: string, seg: 'u' | 's', t0: number, t1: number, off: number, w: number, belly: number, level: Level, parent: string, tone: number, show: 'always' | 'never' = 'always', ft?: readonly [readonly [number, number], readonly [number, number]]): Row => ({ id, seg, t0, t1, off, w, belly, level, parent, tone, show, ...(ft ? { from: ft[0], to: ft[1] } : {}) });
/**
 * Muscles de la cuisse (`u`, axe fourche → genou, t < 0 = au-dessus de la fourche) et de la jambe (`s`, axe genou → cheville). `off` et `w` sont des
 * fractions de la demi-largeur de référence (mi-cuisse / mollet) ; + = côté latéral. Correspondance avec `references/anatomy/ref-02` : quadriceps
 * (rose = droit fémoral, bleu = vaste latéral, violet = vaste médial), sartorius (oblique orange), adducteurs, tibial antérieur, gastrocnémien, soléaire.
 */
const ROWS: readonly Row[] = [
  r('quadriceps', 'u', 0.03, 0.93, 0, 0.98, 0.42, 1, 'leg.thigh', 0.05),
  r('rectus-femoris', 'u', 0, 0.88, 0, 0.34, 0.45, 2, 'quadriceps', 0.15),
  r('vastus-lateralis', 'u', 0.04, 0.93, 0.62, 0.46, 0.4, 2, 'quadriceps', -0.05),
  r('vastus-medialis', 'u', 0.38, 0.98, -0.56, 0.38, 0.72, 2, 'quadriceps', 0.1),
  r('vastus-intermedius', 'u', 0.1, 0.9, 0, 0.3, 0.45, 2, 'quadriceps', -0.1, 'never'),
  r('sartorius', 'u', 0, 1, 0, 0.14, 0.5, 2, 'leg.thigh', 0.2, 'always', [[-0.18, 0.92], [0.98, -0.82]]),
  r('adductors', 'u', 0.02, 0.72, -0.7, 0.42, 0.4, 1, 'leg.thigh', -0.1),
  r('gracilis', 'u', 0.05, 0.9, -0.9, 0.15, 0.4, 2, 'adductors', -0.05),
  r('adductor-longus', 'u', 0, 0.5, -0.62, 0.25, 0.4, 2, 'adductors', 0.05),
  r('adductor-magnus', 'u', 0.08, 0.9, -0.7, 0.3, 0.45, 2, 'adductors', -0.15, 'never'),
  r('pectineus', 'u', -0.08, 0.18, -0.62, 0.18, 0.4, 2, 'adductors', 0),
  r('tensor-fasciae-latae', 'u', -0.2, 0.28, 0.68, 0.2, 0.35, 2, 'leg.thigh', 0.05),
  r('iliotibial-band', 'u', 0.1, 1, 0.82, 0.09, 0.5, 2, 'leg.thigh', -0.1),
  r('hamstrings', 'u', 0.05, 0.95, 0.1, 0.9, 0.45, 1, 'leg.thigh', -0.2, 'never'),
  r('biceps-femoris', 'u', 0.08, 0.95, 0.55, 0.32, 0.45, 2, 'hamstrings', -0.2, 'never'),
  r('semitendinosus', 'u', 0.08, 0.95, -0.1, 0.26, 0.45, 2, 'hamstrings', -0.2, 'never'),
  r('semimembranosus', 'u', 0.1, 0.95, -0.45, 0.28, 0.45, 2, 'hamstrings', -0.2, 'never'),
  r('tibialis-anterior', 's', 0.08, 0.78, 0.28, 0.3, 0.3, 2, 'leg.shin', 0.12),
  r('extensor-digitorum-longus', 's', 0.1, 0.8, 0.6, 0.2, 0.35, 2, 'leg.shin', 0.05),
  r('peroneus-longus', 's', 0.08, 0.62, 0.9, 0.2, 0.35, 2, 'leg.shin', -0.05),
  r('peroneus-brevis', 's', 0.5, 0.95, 0.6, 0.13, 0.4, 2, 'leg.shin', -0.05),
  r('extensor-hallucis-longus', 's', 0.5, 0.92, 0.1, 0.09, 0.4, 2, 'leg.shin', 0.1),
  r('gastrocnemius', 's', 0.04, 0.6, 0, 0.9, 0.35, 1, 'leg.shin', -0.15, 'never'),
  r('gastrocnemius.medial', 's', 0.04, 0.58, -0.8, 0.5, 0.35, 2, 'gastrocnemius', -0.1),
  r('gastrocnemius.lateral', 's', 0.04, 0.55, 0.9, 0.38, 0.33, 2, 'gastrocnemius', -0.1),
  r('soleus', 's', 0.35, 0.92, -0.7, 0.36, 0.55, 2, 'leg.shin', -0.05),
  r('tibialis-posterior', 's', 0.1, 0.85, -0.1, 0.3, 0.4, 2, 'leg.shin', -0.15, 'never'),
  r('flexor-digitorum-longus', 's', 0.15, 0.85, -0.35, 0.22, 0.4, 2, 'leg.shin', -0.15, 'never'),
];
export interface LegResult { readonly atoms: Atom[]; readonly foot: FootFrame; readonly knee: V; readonly ankle: V }
const dot = (c: V, rad: number, k = 6): V[] => Array.from({ length: k }, (_, i) => v(c.x + rad * Math.cos((2 * Math.PI * i) / k), c.y + rad * Math.sin((2 * Math.PI * i) / k)));

/** Cinématique directe plane d'UNE jambe + enveloppes + muscles + repères osseux du genou et de la cheville. */
export function legChain(lf: LegFrame, p: LegParams, side: 'L' | 'R'): LegResult {
  const s: 1 | -1 = side === 'L' ? 1 : -1, pose = side === 'L' ? p.pose.left : p.pose.right, { w, len, y: Y } = lf, h = lf.body.h, vis = lf.body.vis;
  const al = (pose.abduction * Math.PI) / 180, d0 = v(s * Math.sin(al), Math.cos(al)), n0 = v(s * Math.cos(al), -Math.sin(al));
  const lift = 0.22 * h, T0 = v(s * lf.axisX, Y.crotch - lift), C0 = add(T0, mul(d0, lift)), K = add(C0, mul(d0, len.thigh));
  const fc = Math.max(0.35, Math.cos((pose.kneeFlex * Math.PI) / 180)), inward = s * 0.4 * pose.abduction;
  const d1 = rotV(d0, inward), n1 = rotV(n0, inward), A = add(K, mul(d1, len.shin * fc));
  const L1 = lift + len.thigh, tc = lift / L1, at = (rr: number): number => tc + (1 - tc) * rr;
  const ST_T: Station[] = [{ t: 0, lat: w.top, med: w.top - 0.012 * h }, { t: tc, lat: w.top * 0.97, med: w.top * 0.9 }, { t: at(0.45), lat: w.mid * (1.02 + 0.12 * lf.body.vis), med: w.mid * 0.98 }, { t: at(0.85), lat: lerp(w.mid, w.knee, 0.7), med: lerp(w.mid, w.knee, 0.7) }, { t: 1, lat: w.knee, med: w.knee * 0.97 }];
  const ST_S: Station[] = [{ t: 0, lat: w.knee, med: w.knee * 0.97 }, { t: 0.12, lat: w.knee * 0.93, med: w.knee * 0.92 }, { t: 0.3, lat: w.calf * 0.98, med: w.calf * 1.05 }, { t: 0.5, lat: w.calf * 0.9, med: w.calf * 0.92 }, { t: 0.8, lat: lerp(w.ankle, w.calf, 0.3), med: lerp(w.ankle, w.calf, 0.3) }, { t: 1, lat: w.ankle, med: w.ankle }];
  const part = (n: string): string => `${n}.${side}`, out: Atom[] = [];
  out.push(mk(part('leg.thigh'), 'skin', part('thigh'), 'pelvis.shell', 0, limbPoly(T0, K, n0, ST_T, 0, 0.25), { side, z: 5 }));
  out.push(mk(part('leg.shin'), 'skin', part('shin'), part('leg.thigh'), 0, limbPoly(K, A, n1, ST_S, 0.1, 0.1), { side, z: 6 }));
  const seg = { u: { a: C0, b: K, n: n0, w: w.mid }, s: { a: K, b: A, n: n1, w: w.calf } };
  for (const q of ROWS) {
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
  const pc = add(K, mul(d0, -0.045 * h)), ex = (rx: number, ry: number, c: V): V[] => Array.from({ length: 8 }, (_, i) => v(c.x + rx * Math.cos((Math.PI * i) / 4), c.y + ry * Math.sin((Math.PI * i) / 4)));
  const sh = (n: string, pa: string, lvl: Level, po: V[], kind: 'landmark' | 'bone' | 'fat', extra = {}): void => { out.push(mk(part(n), kind, part(pa.startsWith('leg.thigh') || pa === 'quadriceps' ? 'thigh' : 'shin'), part(pa), lvl, po, { side, ...extra })); };
  sh('knee.patella', 'leg.thigh', 2, ex(0.04 * h, 0.048 * h, pc), 'bone', { z: 120 });
  sh('knee.condyle.lateral', 'leg.thigh', 3, dot(add(K, mul(n0, w.knee * 0.82)), 0.02 * h), 'landmark');
  sh('knee.condyle.medial', 'leg.thigh', 3, dot(sub(K, mul(n0, w.knee * 0.85)), 0.022 * h), 'landmark');
  sh('knee.tibial-tuberosity', 'leg.shin', 3, dot(add(K, mul(d1, 0.085 * h)), 0.016 * h), 'landmark');
  sh('knee.fibula-head', 'leg.shin', 3, dot(add(add(K, mul(n1, w.knee * 0.72)), mul(d1, 0.05 * h)), 0.016 * h), 'landmark');
  sh('knee.fat-pad', 'leg.shin', 3, [add(K, mul(d1, 0.02 * h)), add(add(K, mul(n1, w.knee * 0.35)), mul(d1, 0.07 * h)), add(sub(K, mul(n1, w.knee * 0.35)), mul(d1, 0.07 * h))], 'fat', { tone: -0.2 });
  const ln = (n: string, pa: string, pts: V[], extra = {}): void => { out.push(mk(part(n), 'line', part(pa === 'leg.shin' ? 'shin' : 'thigh'), part(pa), 3, pts, { side, open: true, ...extra })); };
  ln('knee.joint-line', 'leg.thigh', [add(K, mul(n0, w.knee * 0.8)), add(K, mul(d0, 0.012 * h)), sub(K, mul(n0, w.knee * 0.82))]);
  ln('knee.quadriceps-tendon', 'leg.thigh', [add(K, mul(d0, -0.16 * h)), add(K, mul(d0, -0.095 * h))]);
  ln('knee.patellar-ligament', 'leg.shin', [add(K, mul(d0, -0.01 * h)), add(K, mul(d1, 0.085 * h))]);
  ln('shin.tibial-crest', 'leg.shin', [add(add(K, mul(d1, 0.09 * h)), mul(n1, -0.1 * w.calf)), sub(add(A, mul(n1, -0.05 * w.calf)), mul(d1, 0.05 * h))]);
  ln('ankle.crease', 'leg.shin', [sub(A, mul(n1, w.ankle * 0.95)), add(A, mul(d1, 0.012 * h)), add(A, mul(n1, w.ankle * 0.95))]);
  ln('ankle.extensor-retinaculum', 'leg.shin', [sub(sub(A, mul(d1, 0.05 * h)), mul(n1, w.ankle * 0.9)), sub(A, mul(d1, 0.04 * h)), add(sub(A, mul(d1, 0.05 * h)), mul(n1, w.ankle * 0.9))]);
  sh('ankle.malleolus.medial', 'leg.shin', 3, dot(sub(A, mul(n1, w.ankle * 0.95)), 0.022 * h), 'landmark');
  sh('ankle.malleolus.lateral', 'leg.shin', 3, dot(add(add(A, mul(n1, w.ankle * 0.95)), mul(d1, 0.02 * h)), 0.02 * h), 'landmark');
  const dF = v(s * Math.sin((pose.footTurnout * Math.PI) / 180), Math.cos((pose.footTurnout * Math.PI) / 180)), nF = v(s * Math.cos((pose.footTurnout * Math.PI) / 180), -Math.sin((pose.footTurnout * Math.PI) / 180));
  return { atoms: out, foot: { o: A, d: dF, n: nF, side, s, pose }, knee: K, ankle: A };
}
