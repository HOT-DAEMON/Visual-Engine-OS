import { memoPure } from '../../perf';
import { bodyFrame } from '../frame';
import { BodyParams, type BodyInput, type NeckAnchor } from '../types';
import { backVolumes } from './back';
import { frontVolumes } from './front';
import { handVolumes } from './hand3d';
import { armChain, armVolumes, jointBalls } from './limb';
import { ball } from './loft';
import { makeNeck } from './neck';
import { VolumeParams, type VolumeInput } from './params';
import { spineAngles } from './spine';
import { makeTrunk } from './trunk';
import type { Volume, VolumeSet } from './types';
import { p3 } from './vec3';

const build = (bp: BodyParams, a: NeckAnchor, vp: VolumeParams): VolumeSet => {
  const f = bodyFrame(bp, a), tr = makeTrunk(f, bp, vp), nk = makeNeck(tr, a, f.dim), H = f.h, y = f.y;
  const vis = f.vis, vols: Volume[] = [tr.envelope, nk.envelope, ...frontVolumes(tr, nk, f, bp, vp), ...backVolumes(tr, nk, f)];
  const chains = ([1, -1] as const).map((s) => armChain(tr, f, s > 0 ? bp.pose.left : bp.pose.right, s > 0 ? vp.swing.left : vp.swing.right, s));
  for (const ch of chains) {
    const pose = ch.side > 0 ? bp.pose.left : bp.pose.right;
    vols.push(...armVolumes(ch, f, vis), ...handVolumes(ch, f, pose, bp.fingers, vp.fingerRelax, vp.seed));
    for (const j of jointBalls(ch, f)) vols.push({ id: j.id, name: `sphère d’articulation ${j.id.split('.')[1]}`, group: 'joint', kind: 'joint', side: ch.side > 0 ? 'L' : 'R', parent: null, level: 3, layer: 8, stations: ball(j.c, j.r), fibres: [], tone: 0, sphere: true });
  }
  // Articulations axiales : C7, charnière thoraco-lombaire, hanches (le bassin est la racine des membres inférieurs).
  const jc7 = tr.point(y.base + 0.02 * H, 0, -0.2 * H).p, jtl = tr.point(y.base + 0.68 * (y.navel - y.base), 0, -0.55 * tr.at(y.waist).D).p;
  for (const [k, c, r] of [['c7', jc7, 0.03 * H], ['t12', jtl, 0.035 * H]] as const) vols.push({ id: `joint.${k}`, name: `sphère d’articulation ${k}`, group: 'joint', kind: 'joint', side: 'C', parent: null, level: 3, layer: 8, stations: ball(c, r), fibres: [], tone: 0, sphere: true });
  for (const s of [1, -1]) vols.push({ id: `joint.hip.${s > 0 ? 'L' : 'R'}`, name: 'sphère d’articulation coxo-fémorale', group: 'joint', kind: 'joint', side: s > 0 ? 'L' : 'R', parent: null, level: 3, layer: 8, stations: ball(tr.point(y.crop + 0.02 * H, s * 1.15, -0.04 * H).p, 0.045 * H), fibres: [], tone: 0, sphere: true });
  const ang = spineAngles(tr.spine), nv = tr.at(y.navel), ch = tr.at(y.nipple);
  const landmarks = new Map([['sternal-notch', tr.point(y.base + 0.03 * H, 0, 0).p], ['c7', jc7], ['sacrum', tr.point(y.crop, Math.PI, 0).p], ['acromion.L', p3(f.x.acr, y.acr, tr.shoulder(1).z)], ['acromion.R', p3(-f.x.acr, y.acr, tr.shoulder(-1).z)]]);
  const measures = { h: H, vis, cobbCervical: ang.cervical, cobbThoracic: ang.thoracic, cobbLumbar: ang.lumbar, thoraxDepthOverWidth: ch.D / ch.X, bellyProjection: (nv.zf - ch.zf) / H, gluteProjection: (tr.at(y.navel + 0.2 * (y.navel - y.base)).zb - tr.at(y.waist).zb) / H, volumes: vols.length, shoulderTiltDeg: Math.atan2(tr.shoulder(1).y - tr.shoulder(-1).y, tr.shoulder(1).x - tr.shoulder(-1).x) * 180 / Math.PI };
  return { volumes: vols, byId: new Map(vols.map((v) => [v.id, v])), measures, landmarks };
};
const memo = memoPure('body-volumes', 'geometry', build, 64);
/** Volumes 3D du corps : pur et mémoïsé par le contenu (le point de vue n'y entre JAMAIS : tourner la caméra ne recalcule rien). Valeurs IMMUABLES. */
export const bodyVolumes = (raw: BodyInput, a: NeckAnchor, vp: VolumeInput = {}): VolumeSet => memo(BodyParams.parse(raw), a, VolumeParams.parse(vp));
