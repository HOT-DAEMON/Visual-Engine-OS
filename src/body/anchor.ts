import { faceLandmarks } from '../face';
import type { FaceParams } from '../schema';
import type { NeckAnchor } from './types';

/** Seul pont vers le visage : le corps lit le COU (repères de `faceLandmarks`, source unique), jamais autre chose. */
export function anchorFromFace(face: FaceParams, W: number, H: number): NeckAnchor {
  const lm = faceLandmarks(face, W, H);
  const { half, bottomY } = lm.neck;
  return { h: lm.H, chinY: lm.chinY, baseY: bottomY, baseHalf: half * (1 + face.neck.flare) };
}
