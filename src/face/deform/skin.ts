import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { smooth } from '../curve';

/**
 * DÉFORMATION ARTICULATOIRE (B, T11) : modèle à DEUX OS (crâne immobile, mandibule mobile) avec POIDS d'attache par point (skinning linéaire).
 * Un point lié à la mandibule avec le poids w se déplace de `w × (translation de la mandibule)`. Les poids sont la réponse à « la lèvre inférieure ne doit pas
 * simplement descendre verticalement » : le centre de la lèvre suit presque entièrement la mandibule (0,88), la commissure à peine (0,3) car elle est retenue par
 * la joue et la lèvre supérieure ; les dents inférieures suivent à 0,94, la lèvre supérieure et le nez à 0.
 */
export interface MandiblePose {
  /** Abaissement de la mandibule vue par la bouche (px) : l'écart de la lèvre inférieure à la ligne de fermeture au centre. */
  readonly dropPx: number;
  /** Translation latérale (px), + = vers la droite de l'image. */
  readonly shiftPx: number;
  /** Avancée (+) ou recul (−) en px : décalage vertical de la lèvre / des dents (en vue de face, l'avancée recouvre la denture). */
  readonly protrusionPx: number;
}

export function mandiblePose(p: FaceParams, lm: FaceLandmarks): MandiblePose {
  const a = p.deform.articulation;
  return { dropPx: lm.lips.openH, shiftPx: a.jawShift * 0.02 * lm.W, protrusionPx: a.protrusion * 0.004 * lm.H };
}

/** Poids d'attache à la mandibule en fonction de la position relative sur la bouche : `u` = x / demi-largeur (−1…1 aux commissures), 0 au centre. */
export const WEIGHT = { lowerLipCenter: 0.88, lowerLipCorner: 0.3, lowerTeeth: 0.94, chin: 1, upperLip: 0 } as const;

/** Poids de la lèvre inférieure à l'abscisse relative `u` : 0,88 au centre, 0,3 aux commissures (transition en cosinus adouci, continue et symétrique). */
export function lipWeight(u: number): number {
  const k = smooth(1 - Math.min(1, Math.abs(u)));
  return WEIGHT.lowerLipCorner + (WEIGHT.lowerLipCenter - WEIGHT.lowerLipCorner) * k;
}

/** Déplacement (px) d'un point lié à la mandibule avec le poids `w` : translation latérale, abaissement, protrusion (qui REMONTE la denture inférieure). */
export function mandibleDisplace(pose: MandiblePose, w: number): Vec {
  return { x: w * pose.shiftPx, y: w * pose.dropPx - w * pose.protrusionPx };
}
