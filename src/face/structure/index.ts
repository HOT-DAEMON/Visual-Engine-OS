import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { faceLandmarks } from '../landmarks';
import { mouthGeometry } from '../mouth';
import { noseGeometry, type NoseGeometry } from '../nose';
import { chinGeometry } from './chin';
import { resolveDependencies } from './dependencies';
import { mandibleGeometry } from './mandible';
import { neckGeometry } from './neck';
import { tissueGeometry } from './tissue';
import type { StructureGeometry } from './types';

export type { StructureGeometry, MandibleGeo, ChinGeo, TissueGeo, CheekGeo, NeckGeo, Blob } from './types';
export { DEPENDENCY_RULES, resolveDependencies, type Derived, type DependencyRule } from './dependencies';

/** Assemble la structure du visage dans l'ordre anatomique : dépendances → mandibule → menton → tissus → cou. Fonction PURE et déterministe. */
export function structureGeometry(p: FaceParams, lm: FaceLandmarks, nose?: NoseGeometry): StructureGeometry {
  const n = nose ?? noseGeometry(p, lm);
  const d = resolveDependencies(p, lm);
  return { mandible: mandibleGeometry(p, lm), chin: chinGeometry(p, lm, d), tissue: tissueGeometry(p, lm, n, d), neck: neckGeometry(p, lm, d) };
}

/**
 * Grandeurs SCALAIRES nommées de la structure : le vocabulaire commun de `DEPENDENCY_RULES`, des tests et de la vérification.
 * Une clé = une mesure faite sur la géométrie réelle (jamais lue dans un paramètre).
 */
export function measureStructure(p: FaceParams, W: number, H: number): Record<string, number> {
  const lm = faceLandmarks(p, W, H);
  const s = structureGeometry(p, lm);
  const d = resolveDependencies(p, lm);
  const mouth = mouthGeometry(p, lm);
  const top = lm.outline.right[0] as { p3: { x: number } };
  return {
    'chin.lateralBlendPx': d.lateralBlendPx,
    'chin.upperBlendDepth': d.upperBlendDepth,
    'chin.widthPx': s.chin.widthPx,
    'neck.shadowReachPx': s.neck.shadowReachPx,
    'neck.halfWidthPx': s.neck.halfWidthPx,
    'neck.platysmaTension': s.neck.platysmaTension,
    'mandible.bodyLengthPx': s.mandible.bodyLengthPx,
    'mandible.bodyHeightY': lm.jaw.gonion.y,
    'mandible.boneHalf': s.mandible.silhouette.boneHalf,
    'mandible.outerHalf': s.mandible.silhouette.outerHalf,
    'mandible.gonialDeg': s.mandible.gonialDeg,
    'mandible.dropPx': lm.jaw.drop,
    'mouth.lowerTeethY': mouth.lowerTeethY,
    'mouth.upperTeethTopY': mouth.upperTeethTopY,
    'mouth.lowerLipBottomY': mouth.lowerLipBottomY,
    'cranium.templeHalf': top.p3.x,
  };
}
