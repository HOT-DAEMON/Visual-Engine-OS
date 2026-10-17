import { el, urlRef } from '../../core/svg';
import { faceLandmarks, outlinePath, type FaceLandmarks } from '../../face';
import { dominantColor, spotGradient, type Surface } from '../../materials';
import { FaceParams, type HostSpec } from '../../schema';
import { renderEars } from './ears';
import type { LightVector } from '../../lighting/light';
import { renderFacialHair } from './facial-hair';
import { renderHair } from './hair';
import { renderMouth } from './mouth';
import { renderNeck } from './neck';
import { renderNose } from './nose';

/** Surface « crâne + mâchoire » d'un hôte `shape: 'face'`, habillable par le système de matériaux. */
export function faceSurface(h: HostSpec, lm: FaceLandmarks): Surface {
  return { bbox: { x: -h.width / 2, y: -h.height / 2, w: h.width, h: h.height }, curvature: 'sphere', draw: (a) => el('path', { d: outlinePath(lm.outline), ...a }) };
}

export interface FaceParts {
  readonly lm: FaceLandmarks;
  readonly defs: string[];
  /** Dessiné AVANT la tête : masse arrière des cheveux, cou, oreilles. */
  readonly behind: string[];
  /** Dessiné APRÈS la tête, avant les yeux : joues, nez, bouche + moustache, barbe, cheveux (cap, frange, pattes). */
  readonly front: string[];
}

export function faceParts(h: HostSpec, L: LightVector, rot: number): FaceParts {
  const params = FaceParams.parse(h.face ?? {});
  const lm = faceLandmarks(params, h.width, h.height);
  const skin = dominantColor(h.material.base);
  const nose = renderNose(h.id, params, lm, skin);
  const defs = [...nose.defs];
  const front: string[] = [];
  if (params.blush > 0.01) {
    const gid = `${h.id}-blush`;
    defs.push(spotGradient(gid, '#e0566a', 0.38 * params.blush, 0.8));
    for (const sg of [-1, 1] as const) {
      front.push(el('ellipse', { cx: sg * lm.W * 0.2, cy: lm.eyeY + 0.12 * lm.H, rx: lm.W * 0.1, ry: lm.H * 0.05, fill: urlRef(gid) }));
    }
  }
  const hair = renderHair(h.id, params, lm, L, rot, skin);
  const neck = renderNeck(h.id, params, lm, skin);
  const fh = renderFacialHair(h.id, params, lm, L, rot);
  defs.push(...hair.defs, ...neck.defs, ...fh.defs);
  // Bouche et moustache forment UN groupe : l'asymétrie les incline ensemble autour du centre de la bouche.
  const tilt = params.asymmetry.mouthTiltDeg;
  const mouthGroup = [...renderMouth(params, lm, skin), ...fh.mustache];
  front.push(...nose.markup, tilt === 0 ? mouthGroup.join('') : el('g', { transform: `rotate(${tilt} 0 ${lm.mouthY})` }, mouthGroup), ...fh.beard, ...hair.front);
  return { lm, defs, behind: [...hair.back, ...neck.markup, ...renderEars(params, lm, skin)], front };
}
