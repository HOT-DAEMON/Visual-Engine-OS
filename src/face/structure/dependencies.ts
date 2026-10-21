import { clamp } from '../../core/math';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';

/**
 * DÉPENDANCES ENTRE PARAMÈTRES (T10) — la catégorie « essentielle » du cahier des charges (H).
 * Deux parties :
 *   1. `DEPENDENCY_RULES` : la table DÉCLARATIVE (quoi modifie quoi, et ce qui doit rester IMMOBILE). Elle est lue par les tests, qui perturbent chaque paramètre
 *      `when` et vérifient (a) que chaque grandeur `recompute` change vraiment, (b) que chaque grandeur `preserve` ne bouge pas : la table ne peut pas mentir.
 *   2. `resolveDependencies` : les formules, UNE fois, lues par la géométrie (`structure/*.ts`) et par le rendu.
 */
export interface DependencyRule {
  readonly id: string;
  /** Chemins de paramètres qui déclenchent le recalcul. */
  readonly when: readonly string[];
  /** Grandeurs (clés de `measureStructure`) qui DOIVENT être recalculées. */
  readonly recompute: readonly string[];
  /** Grandeurs qui NE DOIVENT PAS bouger : c'est le contrat « ne pas allonger toute la mandibule ». */
  readonly preserve: readonly string[];
}

export const DEPENDENCY_RULES: readonly DependencyRule[] = [
  { id: 'chin-projection', when: ['chin.projection'], recompute: ['chin.lateralBlendPx', 'chin.upperBlendDepth', 'neck.shadowReachPx'], preserve: ['mandible.bodyLengthPx', 'neck.halfWidthPx', 'cranium.templeHalf'] },
  { id: 'chin-width', when: ['chinWidth'], recompute: ['chin.widthPx'], preserve: ['mandible.bodyHeightY', 'neck.halfWidthPx', 'cranium.templeHalf'] },
  { id: 'jaw-bone-width', when: ['jawWidth'], recompute: ['mandible.outerHalf', 'mandible.bodyLengthPx'], preserve: ['cranium.templeHalf', 'chin.widthPx'] },
  { id: 'masseter-volume', when: ['softTissue.masseter.volume'], recompute: ['mandible.outerHalf'], preserve: ['mandible.boneHalf', 'cranium.templeHalf', 'chin.widthPx'] },
  { id: 'fat', when: ['softTissue.fat'], recompute: ['mandible.outerHalf', 'mandible.gonialDeg'], preserve: ['mandible.boneHalf', 'cranium.templeHalf'] },
  { id: 'mouth-open', when: ['mouth.open'], recompute: ['mandible.dropPx', 'mouth.lowerTeethY', 'mouth.lowerLipBottomY', 'neck.platysmaTension'], preserve: ['mandible.boneHalf', 'mouth.upperTeethTopY', 'cranium.templeHalf'] },
];

/** Grandeurs dérivées dont dépendent les raccords : toutes recalculées ici, jamais ailleurs. */
export interface Derived {
  /** Largeur (px) de la zone de raccord menton → joues antérieures : plus le menton avance, plus elle s'élargit. */
  readonly lateralBlendPx: number;
  /** Profondeur (0–1) de la transition supérieure (sillon labio-mentonnier) : le menton projeté creuse davantage le sillon, la bouche ouverte l'aplatit. */
  readonly upperBlendDepth: number;
  /** Profondeur (px) de l'ombre portée du menton sur la région sous-mentonnière. */
  readonly submentalReachPx: number;
}

export function resolveDependencies(p: FaceParams, lm: FaceLandmarks): Derived {
  const c = p.chin;
  const proj = c.projection;
  // Raccord latéral : base 2 → 7 % de W selon `lateralBlend`, × (0,7 + 0,8 × projection) : à projection 0,5 le facteur vaut 1.
  const lateralBlendPx = (0.02 + 0.05 * c.lateralBlend) * lm.W * (0.7 + 0.8 * proj);
  // Transition supérieure : plus nette (1 − upperBlend), creusée par la projection, aplatie par l'ouverture (déformation des tissus).
  const upperBlendDepth = clamp((0.3 + 0.7 * (1 - c.upperBlend)) * (0.6 + 0.8 * proj) * (1 - lm.jaw.tissue.sulcusFlatten), 0, 1);
  // Sous-menton : 3 → 8 % de H selon `lowerBlend` net, × (0,8 + 0,9 × projection), × (1 + 0,4 × épaisseur sous-mentonnière).
  const submentalReachPx = (0.03 + 0.05 * (1 - c.lowerBlend)) * lm.H * (0.8 + 0.9 * proj) * (1 + 0.4 * p.jaw.submental);
  return { lateralBlendPx, upperBlendDepth, submentalReachPx };
}
