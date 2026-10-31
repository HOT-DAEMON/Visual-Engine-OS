import type { BodyFrame } from '../frame';
import type { ArmPose } from '../types';
import type { ArmChain } from './limb';
import { ball } from './loft';
import { rng, vol } from './mk';
import type { Volume } from './types';
import { add3, cross3, mul3, norm3, rotAxis, sub3, type P3 } from './vec3';

/** Fractions de la longueur de main (poignet → bout du majeur) : longueur de chaque doigt LIBRE, découpe des phalanges (proximale/moyenne/distale). Conventions d'atelier. */
const FINGER_LEN = [0.34, 0.4, 0.45, 0.42, 0.33] as const;
const SPLIT = [0.5, 0.3, 0.2] as const;
/** Position radiale (en demi-largeurs de paume, + = côté pouce) et fraction de la paume où s'attache chaque doigt. */
const BASE = [[1.05, 0.2], [0.76, 1], [0.26, 1.02], [-0.26, 0.97], [-0.78, 0.9]] as const;
const NAME = ['pouce', 'index', 'majeur', 'annulaire', 'auriculaire'] as const;

/**
 * MAIN 3D : paume (+ éminences thénar/hypothénar) et 5 doigts RELÂCHÉS. Chaque doigt = 3 phalanges lofts + sphères d'articulation (MCP, PIP) + pulpe + ongle ;
 * longueurs, écarts et flexions diffèrent doigt par doigt (déterministes par `seed`, amplitude `relax`) ; tendons extenseurs sur le dos de la main.
 */
export function handVolumes(ch: ArmChain, f: BodyFrame, pose: ArmPose, fingers: readonly number[], relax: number, seed: number): Volume[] {
  const s = ch.side, sd = s > 0 ? 'L' : 'R', H = f.h, A = f.arm, out: Volume[] = [], r = rng(seed * 131 + (s > 0 ? 1 : 2) * 7919);
  const fa = ch.fa, palmN = norm3(sub3(ch.fant, mul3(fa, ch.fant.x * fa.x + ch.fant.y * fa.y + ch.fant.z * fa.z)));
  const rad = mul3(norm3(cross3(fa, palmN)), s);
  const L = A.hand, palmL = 0.55 * L, wr = ch.wr, pw = A.palmHalf, th = pw * 0.42;
  const jit = (k: number): number => 1 + relax * k * (r() * 2 - 1);
  const palmPt = (t: number, lat = 0, up = 0): P3 => add3(add3(add3(wr, mul3(fa, palmL * t)), mul3(rad, pw * lat)), mul3(palmN, th * up));
  const id = (k: string): string => `${k}.${sd}`;
  out.push(vol({ id: id('palm'), name: 'paume', group: 'hand', kind: 'skin', side: sd, layer: 5, level: 1, tier: 0 }, [0, 0.5, 1].map((t, i) => ({ c: palmPt(t), a: [A.wristHalf * 1.02, pw * 0.95, pw][i] as number, b: [A.wristHalf * 0.6, th * 0.9, th * 0.8][i] as number, hint: palmN }))));
  out.push(vol({ id: id('thenar'), name: 'éminence thénar', group: 'hand', side: sd, layer: 5, level: 2, tier: 1, tone: 0.1, origin: 'carpus', insertion: 'thumb-proximal-phalanx' }, [0.05, 0.3, 0.5].map((t, i) => ({ c: palmPt(t, 0.62 - i * 0.12, 0.7), a: pw * [0.3, 0.38, 0.22][i]!, b: th * [0.35, 0.5, 0.3][i]!, hint: palmN }))));
  out.push(vol({ id: id('hypothenar'), name: 'éminence hypothénar', group: 'hand', side: sd, layer: 5, level: 2, tier: 1, tone: 0.08, origin: 'carpus', insertion: 'little-finger-proximal-phalanx' }, [0.1, 0.4, 0.7].map((t, i) => ({ c: palmPt(t, -0.7, 0.6), a: pw * [0.26, 0.3, 0.2][i]!, b: th * [0.3, 0.4, 0.28][i]!, hint: palmN }))));
  for (let i = 0; i < 4; i++) out.push(vol({ id: id(`tendon.hand.${i + 1}`), name: `tendon extenseur du dos de la main ${i + 1}`, group: 'hand', kind: 'tendon', side: sd, layer: 6, level: 3, tier: 4, tone: 0.2, strand: true }, [0.05, 0.5, 1].map((t) => ({ c: palmPt(t, 0.76 - i * 0.5, -1.0), a: 0.005 * H, b: 0.005 * H, hint: mul3(palmN, -1) }))));
  for (let k = 0; k < 5; k++) {
    const [lat, tb] = BASE[k] as readonly [number, number], thumb = k === 0;
    const len = FINGER_LEN[k]! * L * (1 + 0.15 * (fingers[k] ?? 0)) * jit(0.07);
    let d = thumb ? rotAxis(rotAxis(fa, palmN, s * 32 * jit(0.25)), cross3(fa, palmN), 18 * jit(0.3)) : rotAxis(fa, palmN, s * (pose.spread * 11 + 3 * jit(1.2)) * (lat > 0 ? -1 : 1) * Math.min(1, Math.abs(lat) + 0.2) * (lat > 0 ? 1 : 1));
    const base = (thumb ? palmPt(tb, lat, 0.2) : palmPt(tb, lat, 0.05));
    const cv = Math.min(1, Math.max(0, (pose.curl[k] ?? 0.2) + relax * 0.12 * (r() * 2 - 1))), rt = pw * (thumb ? 0.3 : 0.24) * (k === 4 ? 0.82 : 1);
    const angles = thumb ? [8 + 20 * cv, 28 * cv, 36 * cv] : [20 + 55 * cv, 12 + 85 * cv, 8 + 55 * cv];
    let p = base;
    for (let j = 0; j < 3; j++) {
      d = norm3(rotAxis(d, cross3(d, palmN), (angles[j] as number) * (j === 0 ? 0.6 : 1)));
      const lj = len * SPLIT[j]! * (thumb ? 1.12 : 1) * jit(0.05), q = add3(p, mul3(d, lj)), rr = rt * (1 - 0.12 * j), hint = mul3(palmN, -1);
      out.push(vol({ id: id(`finger.${k}.${j + 1}`), name: `${NAME[k]} — phalange ${['proximale', 'moyenne', 'distale'][j]}`, group: 'hand', kind: 'bone', side: sd, layer: 6, level: 2, tier: 0, parent: j ? id(`finger.${k}.${j}`) : id('palm'), n: 4 },
        [{ c: p, a: rr * 1.05, b: rr * 0.92, hint }, { c: add3(p, mul3(sub3(q, p), 0.5)), a: rr * 0.98, b: rr * 0.88 * (j === 2 ? 0.85 : 1), hint }, { c: q, a: rr * (j === 2 ? 0.8 : 0.92), b: rr * (j === 2 ? 0.7 : 0.84), hint }]));
      if (j < 2) out.push({ id: id(`knuckle.${k}.${j + 1}`), name: `${NAME[k]} — articulation ${j ? 'interphalangienne proximale' : 'métacarpo-phalangienne'}`, group: 'joint', kind: 'joint', side: sd, parent: id(`finger.${k}.${j + 1}`), level: 3, layer: 7, stations: ball(q, rr * 1.0), fibres: [], tone: 0.05, sphere: true });
      if (j === 2) {
        out.push(vol({ id: id(`nail.${k}`), name: `${NAME[k]} — ongle`, group: 'hand', kind: 'landmark', side: sd, layer: 7, level: 3, tier: 0, tone: 0.4, n: 3 }, [0.25, 0.62, 0.96].map((t) => ({ c: add3(add3(p, mul3(sub3(q, p), t)), mul3(hint, rr * 0.8)), a: rr * 0.6, b: rr * 0.1, hint }))));
        out.push(vol({ id: id(`pad.${k}`), name: `${NAME[k]} — pulpe`, group: 'hand', kind: 'fat', side: sd, layer: 7, level: 3, tier: 0, tone: 0.1, n: 3 }, [0.2, 0.6, 1].map((t) => ({ c: add3(add3(p, mul3(sub3(q, p), t)), mul3(palmN, rr * 0.5)), a: rr * 0.7, b: rr * 0.35, hint: palmN }))));
      }
      p = q;
    }
  }
  return out;
}
