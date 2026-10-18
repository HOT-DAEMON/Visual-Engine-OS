import { z } from 'zod';
import { Unit } from './primitives';

/**
 * CONTRAT DU MOTEUR DE MENTON ET DE MÂCHOIRE (`src/face/jaw/`, `src/render/face/jaw/`).
 *
 * Menton et mandibule sont des ENFANTS du visage parent. Trois grandeurs du menton sont INDÉPENDANTES :
 *   - LARGEUR     → `FaceParams.chinWidth` (inchangé : largeur du bas du menton, fraction de W) ;
 *   - HAUTEUR     → `chin.height` : distance sillon mentolabial → menton, fraction de H, MESURÉE DANS la hauteur fixe du visage.
 *                   Le bas du crâne reste à H/2 : changer la hauteur du menton ne rallonge JAMAIS le visage, elle déplace
 *                   le sillon mentolabial (donc la proportion lèvre / coussinet) ;
 *   - PROJECTION  → `chin.projection` : avancée du menton devant le plan du visage ; en 2D de face elle est rendue par la
 *                   lumière (reflet du pogonion, ombre du sillon, ombre portée sur le cou), jamais par la longueur.
 * Largeur de la mandibule = `FaceParams.jawWidth` ; hauteur du coin de mâchoire = `FaceParams.jawY` (inchangés).
 */

export const SYMPHYSIS_SHAPES = ['round', 'square', 'pointed', 'cleft'] as const;

/** Menton : hauteur, projection, forme de la symphyse mentonnière, sillon mentolabial, coussinet. */
export const FaceChin = z
  .object({
    /** Hauteur du menton (sillon mentolabial → menton), fraction de H. Bornée par la lèvre inférieure (voir repères). */
    height: z.number().min(0.08).max(0.24).default(0.15),
    projection: Unit.default(0.5),
    /** Forme du bas du menton : arrondie, carrée (méplat), pointue, ou fendue (fossette centrale). */
    symphysis: z.enum(SYMPHYSIS_SHAPES).default('round'),
    /** Profondeur de la fente / fossette quand `symphysis = 'cleft'` (sinon sans effet). */
    cleft: Unit.default(0.5),
    /** Profondeur du sillon mentolabial sous la lèvre inférieure. */
    mentolabial: Unit.default(0.45),
    /** Relief du coussinet mentonnier (reflet du pogonion). */
    pad: Unit.default(0.45),
  })
  .strict();

/** Mandibule, transition mâchoire → cou, mobilité et déformation des tissus. */
export const FaceJaw = z
  .object({
    /** Angle mandibulaire (gonion) : 0 = anguleux (≈ 95°), 1 = très obtus / arrondi (≈ 140°). */
    angle: Unit.default(0.5),
    /** Convergence du corps de la mandibule vers le menton : 0 = quasi parallèle, 1 = en V. */
    taper: Unit.default(0.5),
    /** Transition mâchoire → cou : 0 = angle cervico-mentonnier net, 1 = fondu doux. */
    neckTransition: Unit.default(0.5),
    /** Épaisseur de tissu sous-mentonnier (double menton) : durcit l'ombre sous la mâchoire et l'étale. */
    submental: Unit.default(0.15),
    /** Mobilité : part de l'ouverture de la bouche qui se traduit par un ABAISSEMENT de la mandibule (0 = rigide). */
    mobility: Unit.default(0.5),
    /** Déformation des tissus à l'ouverture : lèvre étirée, sillon aplati, plis naso-géniens creusés, joues remontées. */
    tissue: Unit.default(0.5),
  })
  .strict();

export type FaceChin = z.infer<typeof FaceChin>;
export type FaceJaw = z.infer<typeof FaceJaw>;
