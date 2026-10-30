import { mk } from './atom';
import type { BodyFrame } from './frame';
import { add, limbPoly, lerpV, mul, rotV, spindle, sub, v, type Station } from './shape';
import type { Atom, ArmPose, BodyParams, Level, Side, V } from './types';

/** Repère de la main, produit par l'avant-bras (parent) et consommé par `hand.ts` : c'est TOUT ce que la main sait du bras. */
export interface HandFrame {
  readonly o: V; readonly d: V; readonly n: V; readonly side: 'L' | 'R'; readonly s: 1 | -1;
  /** +1 si le pouce est côté latéral (paume vers l'avant), −1 sinon. */
  readonly tau: 1 | -1;
  /** Facteur de largeur apparente de la main (|sin| de la rotation de l'avant-bras, plancher = épaisseur de la main). */
  readonly hw: number;
  readonly palmar: boolean;
  readonly fc: number;
  readonly pose: ArmPose;
}
export interface ArmResult { readonly atoms: Atom[]; readonly hand: HandFrame; readonly elbow: V; readonly wrist: V }

interface Row { readonly id: string; readonly seg: 'u' | 'f'; readonly t0: number; readonly t1: number; readonly off: number; readonly w: number; readonly belly: number; readonly level: Level; readonly parent: string; readonly tone: number; readonly show: 'always' | 'palmar' | 'dorsal' | 'never' }
/**
 * Muscles du bras, un atome par ligne. `off` et `w` sont des fractions de la demi-largeur du segment (+ = côté latéral pour le bras, + = côté RADIAL
 * pour l'avant-bras : le pouce suit la rotation, donc ces muscles aussi). `show` : visibilité de face selon la face de la main visible.
 */
const ROWS: readonly Row[] = [
  { id: 'deltoid', seg: 'u', t0: 0, t1: 0.42, off: 0.15, w: 1.15, belly: 0.3, level: 1, parent: 'arm.upper', tone: 0.05, show: 'always' },
  { id: 'deltoid.anterior', seg: 'u', t0: 0.02, t1: 0.38, off: 0.0, w: 0.85, belly: 0.35, level: 2, parent: 'deltoid', tone: 0.1, show: 'always' },
  { id: 'deltoid.lateral', seg: 'u', t0: 0.0, t1: 0.42, off: 0.55, w: 0.7, belly: 0.3, level: 2, parent: 'deltoid', tone: -0.08, show: 'always' },
  { id: 'deltoid.posterior', seg: 'u', t0: 0.0, t1: 0.36, off: 0.7, w: 0.55, belly: 0.3, level: 2, parent: 'deltoid', tone: -0.2, show: 'never' },
  { id: 'biceps', seg: 'u', t0: 0.25, t1: 0.88, off: -0.05, w: 0.62, belly: 0.5, level: 1, parent: 'arm.upper', tone: 0.08, show: 'always' },
  { id: 'biceps.long-head', seg: 'u', t0: 0.28, t1: 0.86, off: 0.12, w: 0.4, belly: 0.5, level: 2, parent: 'biceps', tone: 0.1, show: 'always' },
  { id: 'biceps.short-head', seg: 'u', t0: 0.28, t1: 0.86, off: -0.2, w: 0.38, belly: 0.5, level: 2, parent: 'biceps', tone: 0.05, show: 'always' },
  { id: 'brachialis', seg: 'u', t0: 0.45, t1: 0.9, off: 0.45, w: 0.28, belly: 0.5, level: 2, parent: 'arm.upper', tone: -0.05, show: 'always' },
  { id: 'coracobrachialis', seg: 'u', t0: 0.1, t1: 0.5, off: -0.65, w: 0.2, belly: 0.4, level: 2, parent: 'arm.upper', tone: -0.1, show: 'always' },
  { id: 'triceps', seg: 'u', t0: 0.2, t1: 0.9, off: 0.0, w: 0.9, belly: 0.45, level: 1, parent: 'arm.upper', tone: -0.2, show: 'never' },
  { id: 'triceps.long-head', seg: 'u', t0: 0.2, t1: 0.88, off: -0.45, w: 0.4, belly: 0.4, level: 2, parent: 'triceps', tone: -0.1, show: 'always' },
  { id: 'triceps.lateral-head', seg: 'u', t0: 0.3, t1: 0.88, off: 0.5, w: 0.38, belly: 0.4, level: 2, parent: 'triceps', tone: -0.15, show: 'always' },
  { id: 'triceps.medial-head', seg: 'u', t0: 0.45, t1: 0.92, off: 0.0, w: 0.3, belly: 0.5, level: 2, parent: 'triceps', tone: -0.25, show: 'never' },
  { id: 'forearm.flexor-mass', seg: 'f', t0: 0.04, t1: 0.7, off: -0.1, w: 0.85, belly: 0.3, level: 1, parent: 'arm.fore', tone: 0.05, show: 'palmar' },
  { id: 'forearm.extensor-mass', seg: 'f', t0: 0.04, t1: 0.7, off: -0.1, w: 0.85, belly: 0.3, level: 1, parent: 'arm.fore', tone: 0.05, show: 'dorsal' },
  { id: 'brachioradialis', seg: 'f', t0: 0.02, t1: 0.55, off: 0.62, w: 0.42, belly: 0.25, level: 2, parent: 'arm.fore', tone: 0.12, show: 'always' },
  { id: 'pronator-teres', seg: 'f', t0: 0.0, t1: 0.4, off: 0.25, w: 0.3, belly: 0.35, level: 2, parent: 'forearm.flexor-mass', tone: 0.1, show: 'palmar' },
  { id: 'flexor-carpi-radialis', seg: 'f', t0: 0.1, t1: 0.78, off: 0.22, w: 0.28, belly: 0.3, level: 2, parent: 'forearm.flexor-mass', tone: 0.15, show: 'palmar' },
  { id: 'palmaris-longus', seg: 'f', t0: 0.15, t1: 0.85, off: 0.0, w: 0.16, belly: 0.3, level: 2, parent: 'forearm.flexor-mass', tone: 0.0, show: 'palmar' },
  { id: 'flexor-digitorum-superficialis', seg: 'f', t0: 0.12, t1: 0.75, off: -0.17, w: 0.36, belly: 0.35, level: 2, parent: 'forearm.flexor-mass', tone: 0.1, show: 'palmar' },
  { id: 'flexor-carpi-ulnaris', seg: 'f', t0: 0.08, t1: 0.85, off: -0.58, w: 0.3, belly: 0.3, level: 2, parent: 'forearm.flexor-mass', tone: -0.05, show: 'palmar' },
  { id: 'extensor-carpi-radialis-longus', seg: 'f', t0: 0.05, t1: 0.45, off: 0.45, w: 0.33, belly: 0.3, level: 2, parent: 'forearm.extensor-mass', tone: 0.12, show: 'dorsal' },
  { id: 'extensor-carpi-radialis-brevis', seg: 'f', t0: 0.12, t1: 0.6, off: 0.25, w: 0.28, belly: 0.3, level: 2, parent: 'forearm.extensor-mass', tone: 0.08, show: 'dorsal' },
  { id: 'extensor-digitorum', seg: 'f', t0: 0.1, t1: 0.85, off: -0.05, w: 0.48, belly: 0.35, level: 2, parent: 'forearm.extensor-mass', tone: 0.1, show: 'dorsal' },
  { id: 'extensor-carpi-ulnaris', seg: 'f', t0: 0.15, t1: 0.9, off: -0.52, w: 0.3, belly: 0.3, level: 2, parent: 'forearm.extensor-mass', tone: -0.05, show: 'dorsal' },
];

/** Cinématique directe plane d'UN bras + enveloppes + muscles + repères de l'épaule, du coude, du poignet. */
export function armChain(f: BodyFrame, p: BodyParams, side: 'L' | 'R'): ArmResult {
  const s: 1 | -1 = side === 'L' ? 1 : -1;
  const pose = side === 'L' ? p.pose.left : p.pose.right;
  const { arm, h, fat, vis } = f;
  const part = (n: string): string => `${n}.${side}`;
  const J = v(s * f.joint.x, f.joint.y);
  const al = pose.abduction, d0 = v(s * Math.sin((al * Math.PI) / 180), Math.cos((al * Math.PI) / 180)), n0 = v(s * Math.cos((al * Math.PI) / 180), -Math.sin((al * Math.PI) / 180));
  const E = add(J, mul(d0, arm.upper));
  const fc = Math.max(0.15, Math.cos((pose.elbowFlex * Math.PI) / 180));
  const sw = s * pose.forearmSwing;
  const d1 = rotV(d0, sw), n1 = rotV(n0, sw);
  const Wp = add(E, mul(d1, arm.fore * fc));
  const w = arm.armHalf, wf = arm.foreHalf;
  const ST_U: Station[] = [{ t: 0, lat: w * 1.28, med: w * 1.1 }, { t: 0.15, lat: w * 1.25, med: w * 1.05 }, { t: 0.4, lat: w * 1.02, med: w * (1 + 0.12 * fat) }, { t: 0.65, lat: w * 0.98, med: w * (1.02 + 0.14 * fat) }, { t: 0.9, lat: w * 0.88, med: w * 0.86 }, { t: 1, lat: w * 0.92, med: w * 0.9 }];
  const ST_F: Station[] = [{ t: 0, lat: w * 0.92, med: w * 0.9 }, { t: 0.18, lat: wf * 1.08, med: wf * 1.03 }, { t: 0.45, lat: wf * 0.93, med: wf * 0.9 }, { t: 0.8, lat: lerpN(wf, arm.wristHalf, 0.7), med: lerpN(wf, arm.wristHalf, 0.7) }, { t: 1, lat: arm.wristHalf, med: arm.wristHalf }];
  const out: Atom[] = [];
  const sd: Side = side;
  out.push(mk(part('arm.upper'), 'skin', part('upper-arm'), 'torso.shell', 0, limbPoly(J, E, n0, ST_U, 0.55, 0.3), { side: sd, z: 2 }));
  out.push(mk(part('arm.fore'), 'skin', part('forearm'), part('arm.upper'), 0, limbPoly(E, Wp, n1, ST_F, 0.3, 0.12), { side: sd, z: 3 }));
  out.push(mk(part('arm.stump'), 'skin', part('upper-arm'), part('arm.upper'), 2, limbPoly(J, lerpV(J, E, 0.28), n0, [{ t: 0, lat: w * 1.28, med: w * 1.1 }, { t: 1, lat: w * 1.2, med: w * 1.06 }], 0.4, 0.1), { side: sd, z: 4, tone: -0.05 }));
  const seg = { u: { a: J, b: E, n: n0, w }, f: { a: E, b: Wp, n: n1, w: wf } };
  const radial = (pose.pronation <= 0 ? 1 : -1) as 1 | -1;
  const palmar = pose.pronation <= 0;
  for (const r of ROWS) {
    const g = seg[r.seg], rs = r.seg === 'f' ? radial : 1;
    const shown = r.show === 'always' || (r.show === 'palmar' && palmar) || (r.show === 'dorsal' && !palmar);
    const hidden = r.show === 'never' || !shown;
    const poly = spindle(g.a, g.b, g.n, r.t0, r.t1, r.off * rs * g.w, r.w * g.w * (0.85 + 0.25 * vis), r.belly);
    out.push(mk(part(r.id), 'muscle', part(r.seg === 'u' ? 'upper-arm' : 'forearm'), part(r.parent), r.level, poly, { side: sd, z: 110 + r.level * 10, tone: r.tone, ...(hidden ? { view: 'occluded' as const } : {}) }));
  }
  const dot = (c: V, r: number, k = 6): V[] => Array.from({ length: k }, (_, i) => v(c.x + r * Math.cos((2 * Math.PI * i) / k), c.y + r * Math.sin((2 * Math.PI * i) / k)));
  out.push(mk(part('shoulder.joint'), 'landmark', part('upper-arm'), part('arm.upper'), 3, dot(J, 0.02 * h), { side: sd }));
  out.push(mk(part('elbow.epicondyle.lateral'), 'landmark', part('forearm'), part('arm.fore'), 3, dot(add(E, mul(n0, w * 0.78)), 0.018 * h), { side: sd }));
  out.push(mk(part('elbow.epicondyle.medial'), 'landmark', part('forearm'), part('arm.fore'), 3, dot(sub(E, mul(n0, w * 0.82)), 0.02 * h), { side: sd }));
  out.push(mk(part('elbow.olecranon'), 'bone', part('forearm'), part('arm.fore'), 3, dot(add(E, mul(d1, 0.02 * h)), 0.03 * h, 7), { side: sd, view: palmar ? 'occluded' : 'front' }));
  out.push(mk(part('elbow.cubital-fossa'), 'fat', part('forearm'), part('arm.fore'), 3, [add(E, mul(d0, -0.1 * h)), add(add(E, mul(n0, w * 0.3)), mul(d1, 0.08 * h)), add(sub(E, mul(n0, w * 0.3)), mul(d1, 0.08 * h))], { side: sd, tone: -0.25, ...(palmar ? {} : { view: 'occluded' as const }) }));
  const tau = (palmar ? 1 : -1) as 1 | -1;
  out.push(mk(part('wrist.styloid.radial'), 'landmark', part('forearm'), part('arm.fore'), 3, dot(add(Wp, mul(n1, tau * arm.wristHalf * 0.85)), 0.016 * h), { side: sd }));
  out.push(mk(part('wrist.styloid.ulnar'), 'landmark', part('forearm'), part('arm.fore'), 3, dot(add(Wp, mul(n1, -tau * arm.wristHalf * 0.8)), 0.014 * h), { side: sd }));
  out.push(mk(part('wrist.crease'), 'line', part('forearm'), part('arm.fore'), 3, [add(Wp, mul(n1, -arm.wristHalf * 0.9)), add(add(Wp, mul(n1, 0)), mul(d1, 0.012 * h)), add(Wp, mul(n1, arm.wristHalf * 0.9))], { side: sd, open: true, ...(palmar ? {} : { view: 'occluded' as const }) }));
  const dd = rotV(d1, s * pose.wristDev);
  const hand: HandFrame = { o: Wp, d: dd, n: rotV(n1, s * pose.wristDev), side, s, tau, hw: Math.max(0.3, Math.abs(pose.pronation)), palmar, fc: Math.max(0.3, fc), pose };
  return { atoms: out, hand, elbow: E, wrist: Wp };
}
function lerpN(a: number, b: number, t: number): number { return a + (b - a) * t; }
