import { z } from 'zod';
import { Unit } from '../../schema/primitives';

/**
 * CONTRAT DU MEMBRE INFÉRIEUR (bassin, cuisses, genoux, jambes, pieds), VUE DE FACE — `src/body/lower/`.
 * Le bas du corps est l'ENFANT du tronc : il ne porte aucune coordonnée absolue, tout vient du `BodyFrame` (cadre du haut du corps). Les quatre
 * axes (âge, sexe, adiposité, musculature) ne sont PAS dupliqués ici : ils sont lus dans le cadre, source unique. Ce schéma ne porte que ce qui
 * est propre aux jambes : écarts de proportions et pose de chaque jambe. Repère identique au corps : x > 0 = côté GAUCHE du corps, y vers le bas.
 */
const Signed = z.number().min(-1).max(1);

/** Pose d'UNE jambe (projection orthographique du plan frontal : la flexion du genou vers le spectateur RACCOURCIT la jambe). */
export const LegPose = z
  .object({
    /** Écart de la jambe par rapport à la ligne médiane, plan frontal (°). 0 = jambes jointes. */
    abduction: z.number().min(0).max(35).default(4),
    /** Flexion du genou vers le spectateur (°) : la jambe se raccourcit de cos(flexion). */
    kneeFlex: z.number().min(0).max(70).default(0),
    /** Rotation du pied vers l'extérieur (°, négatif = pied en dedans). */
    footTurnout: z.number().min(-15).max(50).default(12),
    /** Écartement des orteils (0 = serrés, 1 = très écartés). */
    toeSpread: Unit.default(0.15),
    /** Flexion des orteils (0 = à plat, 1 = recroquevillés). */
    toeCurl: Unit.default(0),
  })
  .strict();
export type LegPose = z.infer<typeof LegPose>;

export const LegParams = z
  .object({
    /** Écarts de proportions par rapport au canon de l'âge (±1 ≈ ±12 %). Chacun indépendant. */
    limbs: z.object({ thigh: Signed.default(0), shin: Signed.default(0), foot: Signed.default(0), thighGirth: Signed.default(0), kneeWidth: Signed.default(0), calfGirth: Signed.default(0), ankleThickness: Signed.default(0) }).strict().default({}),
    /** Longueur de chaque orteil [gros orteil, 2, 3, 4, 5] : écart ±1 ≈ ±15 %. */
    toes: z.array(Signed).length(5).default([0, 0, 0, 0, 0]),
    /** Poses des deux jambes (indépendantes). `left` = côté gauche du corps = à droite de l'image. */
    pose: z.object({ left: LegPose.default({}), right: LegPose.default({}) }).strict().default({}),
  })
  .strict();
export type LegParams = z.infer<typeof LegParams>;
export type LegInput = z.input<typeof LegParams>;
