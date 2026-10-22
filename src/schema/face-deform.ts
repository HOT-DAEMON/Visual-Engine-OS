import { z } from 'zod';
import { Unit } from './primitives';

/**
 * CONTRAT DES DÉFORMATIONS (tâches T11 et T12 de `docs/TODO-FACE-SPEC.md`). Trois familles, trois emplacements, JAMAIS mélangées :
 *   A. MORPHOLOGIQUE → tous les autres champs de `FaceParams` (forme de base, fixée à la génération du personnage) ;
 *   B. ARTICULATOIRE → `deform.articulation` (+ `mouth.open`, qui reste la source de l'ouverture) : position de la mandibule ;
 *   C. EXPRESSIVE    → `deform.expression` : lèvres, joues, menton, plis.
 * B et C sont des DÉPLACEMENTS relatifs à la morphologie A (voir `face/deform/`) : ils ne réécrivent jamais A, donc ne peuvent pas l'écraser.
 */

/** Articulation de la mandibule (au-delà de l'ouverture `mouth.open`). */
export const DeformArticulation = z
  .object({
    /** Translation latérale de la mandibule (mastication, bouche de travers) : −1 = vers la gauche de l'image, +1 = vers la droite. */
    jawShift: z.number().min(-1).max(1).default(0),
    /** Avancée (+) ou recul (−) de la mandibule : en vue de face, se lit dans le décalage lèvre inférieure / dents. */
    protrusion: z.number().min(-1).max(1).default(0),
    /** Inclinaison de la tête (degrés, + = menton vers le bas) : comprime ou étire le sous-menton et l'angle cervico-mentonnier. */
    headPitchDeg: z.number().min(-30).max(30).default(0),
    /** Serrage des mâchoires : gonfle les masséters (plus de relief, silhouette plus large à l'angle). */
    clench: Unit.default(0),
  })
  .strict();

/** Expression du bas du visage : huit axes qui se COMBINENT (somme de déplacements, pas de remplacement). */
export const DeformExpression = z
  .object({
    /** Sourire (+) : commissures vers le haut et l'extérieur, joues qui remontent ; moue (−) : commissures vers le bas. */
    smile: z.number().min(-1).max(1).default(0),
    /** Grimace : commissures tirées vers l'extérieur, lèvres tendues, dents découvertes. */
    grimace: Unit.default(0),
    /** Colère : lèvre supérieure retroussée, ailes du nez dilatées, plis nasogéniens creusés, lèvre inférieure abaissée. */
    anger: Unit.default(0),
    /** Surprise : lèvre inférieure abaissée, lèvre supérieure légèrement relevée, ailes du nez un peu dilatées (la bouche s'ouvre via `mouth.open`). */
    surprise: Unit.default(0),
    /** Dégoût : lèvre supérieure retroussée haut, ailes dilatées, plis nasogéniens creusés, commissures abaissées. */
    disgust: Unit.default(0),
    /** Dédain : commissures abaissées, lèvres tendues, menton relevé par le mentonnier (version symétrique ; l'asymétrie vient de `stylization.cornerAsymmetry`). */
    disdain: Unit.default(0),
    /** Bouche en « o » : commissures RAPPROCHÉES (pincement), lèvre inférieure légèrement abaissée, lèvres arrondies. */
    ooh: Unit.default(0),
    /** Caricature : multiplicateur global des déplacements (1 + 1,5 × caricature). */
    caricature: Unit.default(0),
  })
  .strict();

export const FaceDeform = z
  .object({
    articulation: DeformArticulation.default({}),
    expression: DeformExpression.default({}),
  })
  .strict();

export type FaceDeform = z.infer<typeof FaceDeform>;
