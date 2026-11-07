import { faceLandmarks } from '../face';
import { neckModelFor } from '../neck';
import type { FaceParams } from '../schema';
import type { NeckAnchor } from './types';

/**
 * Seul pont vers le visage : le corps lit le COU, jamais autre chose. La largeur de raccord `baseHalf` est celle de la DERNIÈRE SECTION du moteur de cou
 * (demi-largeur moyenne droite/gauche à la base) et non plus `half × (1 + flare)` : avec évasement exagéré, trapèzes, cône, masse ou compression, l'ancienne
 * formule laissait une marche visible entre la base du cou et le haut du torse (critère « transition cou-torse : aucune séparation de l'enveloppe »).
 * Par défaut, l'écart avec l'ancienne valeur est inférieur à 1 % (testé).
 */
export function anchorFromFace(face: FaceParams, W: number, H: number): NeckAnchor {
  const lm = faceLandmarks(face, W, H);
  const last = neckModelFor(face, lm).stations.at(-1)!;
  return { h: lm.H, chinY: lm.chinY, baseY: lm.neck.bottomY, baseHalf: (last.aL + last.aR) / 2 };
}
