import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { superEllipse } from '../curve';
import type { FaceLandmarks } from '../landmarks';
import type { Blob, CheekGeo } from '../structure/types';
import { resolveExpression, type ExpressionPulls } from './expression';
import { displaceAll, pullsOf, tissueField, type TissueField } from './field';
import { mandiblePose, type MandiblePose } from './skin';
import { preserveArea, type Preserved } from './volume';

export { resolveExpression, type ExpressionPulls } from './expression';
export { mandiblePose, mandibleDisplace, lipWeight, WEIGHT, type MandiblePose } from './skin';
export { tissueField, pullsOf, displaceAll, type Pull, type TissueField } from './field';
export { preserveArea, centroid, type Preserved } from './volume';

/**
 * COMPOSITION DES TROIS DÉFORMATIONS (T12) — le point où A (morphologie), B (articulation) et C (expression) se rencontrent.
 *   A : les paramètres morphologiques ne sont JAMAIS lus ici pour être modifiés : ils ne servent qu'à positionner les noyaux.
 *   B : `pose` (mandibule), appliquée par poids aux éléments liés (voir `skin.ts`).
 *   C : `pulls` + `field` (expression), appliqués aux tissus mous.
 * Le champ de tissu se COMBINE avec la pose par SOMME de déplacements (jamais par remplacement d'une forme) : un personnage à mâchoire massive qui sourit
 * garde sa mandibule (os) ; seuls les tissus mous bougent, avec maintien d'aire.
 */
export interface FacePose {
  readonly pose: MandiblePose;
  readonly pulls: ExpressionPulls;
  readonly field: TissueField;
  /** Chair des joues après expression, aire conservée (`stretch` = étirement mesuré avant correction). */
  readonly cheeks: { readonly left: Preserved; readonly right: Preserved };
}

/** Polygone d'une ellipse orientée (32 sommets) : sert à donner une aire mesurable à un volume mou. */
export function blobPoly(b: Blob): Vec[] {
  const t = (b.rotDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return superEllipse(0, 0, b.rx, b.ry, 2, 32).map((q) => ({ x: b.c.x + q.x * c - q.y * s, y: b.c.y + q.x * s + q.y * c }));
}

export function facePose(p: FaceParams, lm: FaceLandmarks, cheeks: { readonly left: CheekGeo; readonly right: CheekGeo }): FacePose {
  const pulls = resolveExpression(p, lm);
  // Les noyaux des joues sont posés au centre de la chair de chaque joue (repère de la structure).
  const field = tissueField(pullsOf(pulls, lm, [cheeks.left.volume.c, cheeks.right.volume.c]));
  const move = (ch: CheekGeo): Preserved => {
    const base = blobPoly(ch.volume);
    return preserveArea(base, displaceAll(base, field));
  };
  return { pose: mandiblePose(p, lm), pulls, field, cheeks: { left: move(cheeks.left), right: move(cheeks.right) } };
}
