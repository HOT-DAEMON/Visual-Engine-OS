import { el, urlRef } from '../../core/svg';
import { faceLandmarks, outlinePath, type FaceLandmarks } from '../../face';
import { dominantColor, spotGradient, type Surface } from '../../materials';
import { FaceParams, type HostSpec } from '../../schema';
import { renderEars } from './ears';
import { renderMouth } from './mouth';
import { renderNose } from './nose';

/** Surface « crâne + mâchoire » d'un hôte `shape: 'face'`, habillable par le système de matériaux. */
export function faceSurface(h: HostSpec, lm: FaceLandmarks): Surface {
  return { bbox: { x: -h.width / 2, y: -h.height / 2, w: h.width, h: h.height }, curvature: 'sphere', draw: (a) => el('path', { d: outlinePath(lm.outline), ...a }) };
}

export interface FaceParts {
  readonly lm: FaceLandmarks;
  readonly defs: string[];
  /** Dessiné AVANT la tête (oreilles). */
  readonly behind: string[];
  /** Dessiné APRÈS la tête, avant les yeux (joues, nez, bouche). */
  readonly front: string[];
}

export function faceParts(h: HostSpec): FaceParts {
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
  front.push(...nose.markup, ...renderMouth(params, lm, skin));
  return { lm, defs, behind: renderEars(params, lm, skin), front };
}
