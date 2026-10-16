import { headOutline, type Outline } from './outline';
import type { FaceParams } from '../schema';
import type { Vec } from '../geometry/eye/primitives';

/**
 * Repères anatomiques d'un visage, en pixels dans le repère local de l'hôte (origine au centre).
 * SOURCE UNIQUE de vérité : le rendu du nez/de la bouche et le placement des yeux lisent ces mêmes
 * valeurs, donc un œil ne peut pas « dériver » par rapport au visage qui le porte.
 */
export interface FaceLandmarks {
  readonly W: number;
  readonly H: number;
  readonly outline: Outline;
  /** Ordonnée de la ligne des yeux. */
  readonly eyeY: number;
  /** Canthus interne de l'œil de gauche de l'IMAGE (x < 0) et de droite (x > 0), sur la ligne des yeux. */
  readonly innerCanthus: { readonly left: Vec; readonly right: Vec };
  readonly noseBaseY: number;
  readonly noseTipY: number;
  readonly mouthY: number;
  readonly chinY: number;
  /** Limites verticales (ordonnées) de la zone des yeux : au-dessus, le front nu ; au-dessous, le nez. */
  readonly browLimitY: number;
  readonly lowerLimitY: number;
}

/** Marge entre la bouche et la base du nez (fraction de H) : la bouche ne remonte jamais sous le nez. */
const NOSE_MOUTH_GAP = 0.07;

export function faceLandmarks(p: FaceParams, W: number, H: number): FaceLandmarks {
  const eyeY = -H / 2 + p.eyeLine * H;
  const half = (p.eyeGap * W) / 2;
  const noseBaseY = eyeY + p.nose.length * H;
  return {
    W,
    H,
    outline: headOutline(p, W, H),
    eyeY,
    innerCanthus: { left: { x: -half, y: eyeY }, right: { x: half, y: eyeY } },
    noseBaseY,
    noseTipY: noseBaseY - 0.012 * H,
    mouthY: Math.max(-H / 2 + p.mouth.y * H, noseBaseY + NOSE_MOUTH_GAP * H),
    chinY: H / 2,
    // Le sourcil reste sous le front nu (le haut du crâne, sans cheveux) ; l'œil reste au-dessus du nez.
    browLimitY: -H / 2 + 0.12 * H,
    lowerLimitY: eyeY + 0.5 * p.nose.length * H + 0.04 * H,
  };
}
