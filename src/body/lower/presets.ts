import type { LegInput } from './types';

/**
 * PRÉRÉGLAGE « ref-02 » : jambes ajustées pour épouser la silhouette de la planche `references/anatomy/ref-02` (homme très musclé, 7,72 têtes), trouvé par descente de coordonnées sur
 * l'IoU de silhouette des jambes (`scripts/body-refs/legs-fit.ts`, mesure `legs-iou.ts`, archétype `veryMuscular`). IoU des jambes : **0,436 avec les valeurs par défaut → 0,788 avec ce préréglage**
 * (sol à 865 px dans les deux cas ; cuisses 194 px contre 184 ; genoux 221 contre 221).
 * Ce n'est PAS le canon : `cuisse` et `tour de cuisse` sont à leur borne (+1 ≈ +12 %), signe que cette figure héroïque est plus massive que le canon de l'âge ; les défauts restent ceux de tous les
 * archétypes. À utiliser pour reproduire la planche, pas comme valeur par défaut.
 */
export const LEGS_REF02: LegInput = {
  limbs: { thigh: 1, shin: 0.8, thighGirth: 1, kneeWidth: 0, calfGirth: 0.8, foot: 0, ankleThickness: 0 },
  pose: { left: { abduction: 10, footTurnout: 0 }, right: { abduction: 10, footTurnout: 0 } },
};
