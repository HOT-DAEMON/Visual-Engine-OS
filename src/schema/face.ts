import { z } from 'zod';
import { Appearance } from './appearance';
import { Hex, Unit } from './primitives';
import { FaceAsymmetry, FaceFacialHair, FaceHair, FaceNeck } from './face-extras';
import { FaceNose } from './face-nose';
import { FaceChin, FaceJaw } from './face-jaw';
import { FaceLighting } from './face-lighting';
import { SkinMaterial } from './skin-material';
import { FaceCheek, FaceMandible, FaceSoftTissue } from './face-structure';
import { FaceDeform } from './face-deform';
import { FaceRenderMode, FaceStylization } from './face-style';

export { FaceNose };

/**
 * Paramètres d'un visage complet (hôte `shape: 'face'`). TOUTES les proportions sont des fractions de
 * la largeur `W` ou de la hauteur `H` de l'hôte : changer la taille de l'hôte met donc le visage à
 * l'échelle sans rien déformer. Les positions des yeux (ligne des yeux, écart entre canthi internes)
 * sont définies ICI, une seule fois, et le reste du moteur (rendu du nez/de la bouche, ajustement des
 * yeux) les relit via `face/landmarks.ts` — jamais de copie : c'est ce qui garantit la cohérence.
 */
export const FaceMouth = z
  .object({
    /** Position verticale de la commissure, fraction de H depuis le haut du crâne. */
    y: z.number().min(0.7).max(0.9).default(0.8),
    /** Largeur, fraction de W. */
    width: z.number().min(0.16).max(0.5).default(0.3),
    upperLip: Unit.default(0.4),
    lowerLip: Unit.default(0.55),
    /** -1 : commissures vers le bas ; +1 : sourire. */
    curve: z.number().min(-1).max(1).default(0.1),
    /** 0 : fermée ; 1 : grande ouverture (intérieur sombre + dents). */
    open: Unit.default(0),
    /** Couleur des lèvres ; null : dérivée de la peau. */
    color: Hex.nullable().default(null),
    /** Arc de Cupidon : profondeur du creux central, largeur de l'arc, relief du tubercule médian (moteur `structured`). */
    cupid: z.object({ depth: Unit.default(0.5), width: Unit.default(0.5), tubercle: Unit.default(0.4) }).strict().default({}),
    /** Asymétrie des commissures : −1 = la gauche de l'image plus haute, +1 = la droite plus haute. */
    cornerAsym: z.number().min(-1).max(1).default(0),
    /** Irrégularité de la ligne de fermeture : 0 = courbe régulière, 1 = ondulée (S). */
    lineWave: Unit.default(0),
    /** Dents visibles quand la bouche est ouverte (supérieures, inférieures), gencive découverte, langue visible, profondeur sombre de la cavité. */
    teeth: z.object({ upper: Unit.default(0.6), lower: Unit.default(0.4) }).strict().default({}),
    gums: Unit.default(0.3),
    tongue: Unit.default(0.4),
    cavity: Unit.default(0.6),
    /** Profondeur des plis des tissus autour des commissures (moteur `structured`). */
    cornerFolds: Unit.default(0.4),
    /** Adaptation à la mâchoire : 0 = largeur absolue (`width` × W), 1 = proportionnelle à la largeur du visage à la hauteur de la bouche. */
    fit: Unit.default(0),
  })
  .strict();

export const FaceEars = z
  .object({
    visible: z.boolean().default(true),
    /** Largeur d'une oreille, fraction de W. */
    size: z.number().min(0.04).max(0.16).default(0.09),
    /** Rapport hauteur/largeur. */
    aspect: z.number().min(1).max(2.6).default(1.6),
    /** Inclinaison (degrés) : le haut penche vers l'extérieur si positif. */
    tiltDeg: z.number().min(-20).max(30).default(8),
  })
  .strict();

export const FaceParams = z
  .object({
    /** Largeur de la mâchoire (au coin), fraction de W. */
    jawWidth: z.number().min(0.5).max(0.98).default(0.8),
    /** Largeur du menton (partie basse), fraction de W. */
    chinWidth: z.number().min(0.06).max(0.5).default(0.22),
    /** Hauteur de la plus grande largeur du crâne (temples), fraction de H depuis le haut. */
    templeY: z.number().min(0.22).max(0.5).default(0.36),
    /** Hauteur du coin de mâchoire, fraction de H depuis le haut. */
    jawY: z.number().min(0.6).max(0.88).default(0.74),
    /** Hauteur de la ligne des yeux (passe par les deux canthi internes), fraction de H depuis le haut. */
    eyeLine: z.number().min(0.4).max(0.58).default(0.48),
    /** Écart entre les deux canthi internes, fraction de W. */
    eyeGap: z.number().min(0.1).max(0.34).default(0.2),
    /** Joues rosées (0 = aucune). */
    blush: Unit.default(0),
    nose: FaceNose.default({}),
    /** Menton (hauteur, projection, symphyse…) et mandibule (angle, transition cou, mobilité) : voir `face-jaw.ts`. */
    chin: FaceChin.default({}),
    jaw: FaceJaw.default({}),
    mouth: FaceMouth.default({}),
    ears: FaceEars.default({}),
    /** Cou, cheveux, pilosité, asymétrie : voir `face-extras.ts` (désactivés par défaut). */
    neck: FaceNeck.default({}),
    hair: FaceHair.default({}),
    facialHair: FaceFacialHair.default({}),
    asymmetry: FaceAsymmetry.default({}),
    /** Apparence de la peau (teintes d'ombre/lumière/contour) : lue par le cou, les oreilles, la transition à l'implantation. */
    skin: Appearance.default({}),
    /** Matériau de peau (rugosité par région, reflet diélectrique, diffusion sous-cutanée) : indépendant de la géométrie, voir `skin-material.ts`. */
    skinMaterial: SkinMaterial.default({}),
    /** Lumières de contour, ombres de contact, zones lumineuses des composants : voir `face-lighting.ts`. */
    lighting: FaceLighting.default({}),
    /** `classic` : visage d'avant (aucun calque de structure). `structured` : moteur de structure (régions du nez, tissus mous, bouche structurée, plis). */
    anatomyEngine: z.enum(['classic', 'structured']).default('classic'),
    /** Structure profonde et tissus mous : voir `face-structure.ts`. Défauts neutres. */
    mandible: FaceMandible.default({}),
    softTissue: FaceSoftTissue.default({}),
    cheek: FaceCheek.default({}),
    /** Déformations articulatoire et expressive (la morphologie, elle, est le reste de ce contrat) : voir `face-deform.ts`. */
    deform: FaceDeform.default({}),
    /** Profil de stylisation (géométrie) et mode de rendu (traitement) : deux champs distincts, voir `face-style.ts`. */
    stylization: FaceStylization.default({}),
    renderMode: FaceRenderMode.default('realistic'),
  })
  .strict();
export type FaceParams = z.infer<typeof FaceParams>;
export type FaceParamsInput = z.input<typeof FaceParams>;
