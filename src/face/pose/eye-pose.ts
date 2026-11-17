import { FaceParams, type HostSpec } from '../../schema';
import { faceLandmarks } from '../landmarks';
import { applyStylization } from '../stylize';
import { poseFaceFeatures } from './features';

/**
 * POSE DES YEUX D'UN VISAGE HÔTE (`docs/ROTATION-FACE-FEATURES.md`). Les yeux sont des objets posés sur l'ancre `canthus-*` de l'hôte :
 * quand `headPose.yawDeg` ≠ 0, leur centre suit le nœud `eyeL` / `eyeR` de l'arbre de pose (décalage ajouté à l'ANCRE, dans le repère local de
 * l'hôte) et leur enveloppe est raccourcie par le moteur d'yeux lui-même (`headTurn.model = 'sphere'`, `parallax = false` : l'œil tourne sur
 * place, le décalage est celui de l'hôte, donc jamais de double parallaxe). Retourne `null` à 0° (rendu historique inchangé à l'octet près).
 */
export interface EyePose {
  /** Décalage (px, repère local de l'hôte) à ajouter à l'ancre de l'œil. */
  readonly dx: number;
  readonly dy: number;
  readonly headTurn: { readonly yawDeg: number; readonly pitchDeg: number; readonly model: 'sphere'; readonly azimuthDeg: number; readonly parallax: false };
}

export function eyePoseOf(host: HostSpec, anchorX: number): EyePose | null {
  if (host.shape !== 'face') return null;
  const yaw = host.face?.headPose?.yawDeg ?? 0;
  if (yaw === 0) return null;
  const params = applyStylization(FaceParams.parse(host.face ?? {}));
  const lm = faceLandmarks(params, host.width, host.height);
  const f = poseFaceFeatures(lm, yaw);
  const side = anchorX < 0 ? 'eyeL' : 'eyeR';
  const n = f.nodes.get(side);
  const o = f.neutral.get(side);
  if (!n || !o) return null;
  const azimuthDeg = Math.max(-55, Math.min(55, f.azimuth.get(side) ?? 0));
  return { dx: n.x - o.x, dy: n.y - o.y, headTurn: { yawDeg: yaw, pitchDeg: 0, model: 'sphere', azimuthDeg, parallax: false } };
}
