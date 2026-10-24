import type { FaceLandmarks } from '../landmarks';
import { neckOf, TWIST, type Neck } from './neck';
import { skullOf, type Skull } from './skull';
import { poseTree, type PoseNode, type Posed, type V3 } from './tree';

export { poseTree, skullOf, neckOf, TWIST };
export const FACE_POSE_VERSION = 1;
export type { PoseNode, Posed, V3, Skull, Neck };

/** Visage posé : positions projetées de chaque composant, crâne et cou. */
export interface PosedFace {
  readonly yaw: number;
  readonly pitch: number;
  readonly nodes: Map<string, Posed>;
  readonly skull: Skull;
  readonly neck: Neck;
  /** Demi-largeur de la silhouette du crâne / du cou projetée, à l'ordonnée y. */
  skullHalf(y: number): number;
  neckHalf(): number;
}

/**
 * Arbre des composants du visage, construit à partir des repères (`lm`) : tête → {crâne → {front, oreilles}, visage → {sourcils,
 * yeux → {iris}, nez, joues, bouche, mâchoire → menton}, cou}. Les positions locales sont dans le repère du parent ; z vient de la
 * surface du crâne (`zAt`) plus la saillie propre du composant (le nez dépasse du visage, l'œil est en retrait).
 */
export function faceNodes(lm: FaceLandmarks, skull: Skull, neck: Neck): PoseNode[] {
  const { W } = lm;
  const L = lm.innerCanthus.left;
  const R = lm.innerCanthus.right;
  const z = (x: number, y: number, extra = 0): number => skull.zAt(x, y) + extra;
  const at = (x: number, y: number, extra = 0): V3 => ({ x, y, z: z(x, y, extra) });
  const rel = (p: V3, o: V3): V3 => ({ x: p.x - o.x, y: p.y - o.y, z: p.z - o.z });
  const faceO: V3 = { x: 0, y: lm.eyeY, z: z(0, lm.eyeY) };
  const eyeL = at(L.x * 1.9, lm.eyeY, -0.01 * W);
  const eyeR = at(R.x * 1.9, lm.eyeY, -0.01 * W);
  const azOf = (x: number, y: number): number => (Math.asin(Math.max(-1, Math.min(1, x / skull.rx))) * 180) / Math.PI * (y <= lm.jawY ? 1 : 0.8);
  const nodes: PoseNode[] = [
    { id: 'head', parent: null, local: { x: 0, y: skull.cy, z: 0 }, azimuth: 0 },
    { id: 'skull', parent: 'head', local: { x: 0, y: 0, z: 0 }, azimuth: 0 },
    { id: 'forehead', parent: 'skull', local: rel(at(0, (lm.hair.centerY + lm.browLimitY) / 2), { x: 0, y: skull.cy, z: 0 }), azimuth: 0 },
    { id: 'earL', parent: 'skull', local: rel({ x: -skull.rx, y: (lm.eyeY + lm.noseBaseY) / 2, z: -0.05 * W }, { x: 0, y: skull.cy, z: 0 }), azimuth: -78 },
    { id: 'earR', parent: 'skull', local: rel({ x: skull.rx, y: (lm.eyeY + lm.noseBaseY) / 2, z: -0.05 * W }, { x: 0, y: skull.cy, z: 0 }), azimuth: 78 },
    { id: 'face', parent: 'head', local: rel(faceO, { x: 0, y: skull.cy, z: 0 }), azimuth: 0 },
    { id: 'browL', parent: 'face', local: rel(at(eyeL.x, lm.browLimitY + 0.02 * lm.H, 0.004 * W), faceO), azimuth: azOf(eyeL.x, lm.eyeY) },
    { id: 'browR', parent: 'face', local: rel(at(eyeR.x, lm.browLimitY + 0.02 * lm.H, 0.004 * W), faceO), azimuth: azOf(eyeR.x, lm.eyeY) },
    { id: 'eyeL', parent: 'face', local: rel(eyeL, faceO), azimuth: azOf(eyeL.x, lm.eyeY) },
    { id: 'eyeR', parent: 'face', local: rel(eyeR, faceO), azimuth: azOf(eyeR.x, lm.eyeY) },
    { id: 'irisL', parent: 'eyeL', local: { x: 0, y: 0, z: 0.012 * W }, azimuth: 0 },
    { id: 'irisR', parent: 'eyeR', local: { x: 0, y: 0, z: 0.012 * W }, azimuth: 0 },
    { id: 'nose', parent: 'face', local: rel(at(0, lm.noseTipY, 0.16 * W), faceO), azimuth: 0 },
    { id: 'cheekL', parent: 'face', local: rel(at(-0.7 * skull.rx, (lm.noseBaseY + lm.mouthY) / 2), faceO), azimuth: azOf(-0.7 * skull.rx, lm.noseBaseY) },
    { id: 'cheekR', parent: 'face', local: rel(at(0.7 * skull.rx, (lm.noseBaseY + lm.mouthY) / 2), faceO), azimuth: azOf(0.7 * skull.rx, lm.noseBaseY) },
    { id: 'mouth', parent: 'face', local: rel(at(0, lm.mouthY, 0.05 * W), faceO), azimuth: 0 },
    { id: 'jaw', parent: 'head', local: rel(at(0, lm.jawY), { x: 0, y: skull.cy, z: 0 }), azimuth: 0 },
    { id: 'chin', parent: 'jaw', local: rel(at(0, lm.chinY, 0.03 * W), at(0, lm.jawY)), azimuth: 0 },
    { id: 'neck', parent: 'head', local: { x: 0, y: (neck.topY + neck.bottomY) / 2 - skull.cy, z: neck.zAxis }, ratio: TWIST, azimuth: 0 },
  ];
  return nodes;
}

export function posedFace(lm: FaceLandmarks, yawDeg: number, pitchDeg = 0): PosedFace {
  const skull = skullOf(lm);
  const neck = neckOf(lm, skull);
  // Pivot de la tête : sommet du cou (l'axe vertical passe par x = 0, z = 0 ; le tangage tourne autour de ce point).
  const nodes = poseTree(faceNodes(lm, skull, neck), yawDeg, pitchDeg, { x: 0, y: neck.topY, z: 0 });
  return { yaw: yawDeg, pitch: pitchDeg, nodes, skull, neck, skullHalf: (y) => skull.halfAt(y, yawDeg), neckHalf: () => neck.halfAt(yawDeg) };
}
