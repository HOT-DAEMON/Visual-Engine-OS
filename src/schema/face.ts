import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * Paramètres d'un visage complet (hôte `shape: 'face'`). TOUTES les proportions sont des fractions de
 * la largeur `W` ou de la hauteur `H` de l'hôte : changer la taille de l'hôte met donc le visage à
 * l'échelle sans rien déformer. Les positions des yeux (ligne des yeux, écart entre canthi internes)
 * sont définies ICI, une seule fois, et le reste du moteur (rendu du nez/de la bouche, ajustement des
 * yeux) les relit via `face/landmarks.ts` — jamais de copie : c'est ce qui garantit la cohérence.
 */
export const FaceNose = z
  .object({
    /** Distance ligne des yeux → base du nez, fraction de H. */
    length: z.number().min(0.08).max(0.26).default(0.16),
    /** Largeur des ailes du nez, fraction de W. */
    width: z.number().min(0.08).max(0.3).default(0.16),
    /** Taille des narines (0 = invisibles). */
    nostril: Unit.default(0.6),
    /** Relief de l'arête (ombres latérales). */
    bridge: Unit.default(0.4),
  })
  .strict();

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
    mouth: FaceMouth.default({}),
    ears: FaceEars.default({}),
  })
  .strict();
export type FaceParams = z.infer<typeof FaceParams>;
export type FaceParamsInput = z.input<typeof FaceParams>;
