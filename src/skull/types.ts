import { z } from 'zod';
import { Unit } from '../schema/primitives';

/**
 * CONTRAT DU MOTEUR DE CRÂNE EN VUE DE PROFIL (`src/skull/`).
 *
 * Le crâne et le visage sont UNE SEULE tête : les hauteurs (ligne des yeux, base du nez, bouche, menton) viennent des repères du visage
 * de face (`face/landmarks.ts`, source unique) ; ce module n'y ajoute que la PROFONDEUR (axe avant-arrière) et ce que la vue de face
 * ne montre pas : voûte crânienne, occiput, protubérance occipitale, nuque, cou. Les axes ci-dessous sont indépendants (aucun n'est
 * couplé à une « origine ») ; tous sont des fractions ou des valeurs signées bornées, mises à l'échelle par H (hauteur sommet → menton).
 * Repère : x vers l'AVANT du visage (le visage regarde à droite), y vers le bas, origine = porion (conduit auditif), y = 0 au sommet.
 */
export const HAIR_STYLES = ['none', 'short', 'undercut', 'updo'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

const Signed = z.number().min(-1).max(1);

export const SkullParams = z
  .object({
    /** Longueur de la tête (glabelle → opisthocrânion) : -1 brachycéphale (courte) … +1 dolichocéphale (longue). */
    length: Signed.default(0),
    /** Hauteur de la voûte au-dessus de la ligne des yeux : 0 = bombée basse, 1 = haute. */
    vaultHeight: Unit.default(0.5),
    /** Position du point culminant : 0 = en arrière, 1 = en avant. */
    vaultPeak: Unit.default(0.45),
    /** Inclinaison du front : 0 = vertical, 1 = fuyant. */
    foreheadSlope: Unit.default(0.35),
    /** Bosse frontale (rondeur du front). */
    frontalBulge: Unit.default(0.5),
    /** Arcade sourcilière / glabelle : 0 = lisse, 1 = proéminente. */
    browRidge: Unit.default(0.4),
    /** Projection de l'occiput vers l'arrière (chignon occipital). */
    occiput: Unit.default(0.5),
    /** Protubérance occipitale externe (inion) : saillie de la base de l'occiput. */
    inion: Unit.default(0.4),
    /** Épaisseur du cuir chevelu / du tissu sous-cutané du crâne. */
    scalp: Unit.default(0.5),
    /** Prognathisme alvéolaire maxillaire : -1 rétrusion … +1 protrusion. */
    maxilla: Signed.default(0),
    /** Saillie de l'os zygomatique (pommette) : creux … saillant. */
    zygoma: Unit.default(0.5),
    /** Avancée de la tête sur le cou (inclinaison du cou, degrés ≈ 5…28). */
    neckTilt: Unit.default(0.4),
    /** Profondeur antéro-postérieure du cou, fraction de H (indépendante de la largeur de face). */
    neckDepth: Unit.default(0.45),
    /** Lordose cervicale : creux de la nuque. */
    lordosis: Unit.default(0.5),
    /** Saillie de la vertèbre C7 (vertebra prominens). */
    c7: Unit.default(0.45),
    /** Montée du trapèze vers l'épaule : 0 = étroit, 1 = large. */
    trapezius: Unit.default(0.5),
    /** Saillie du cartilage thyroïde (pomme du cou). */
    thyroid: Unit.default(0.25),
    /** Coiffure de la vue de profil (voir docs/SKULL-PROFILE-REMAINING.md : les coiffures complètes ne sont pas encore projetées). */
    hair: z.enum(HAIR_STYLES).default('none'),
    /** Hauteur de l'implantation des cheveux à la nuque : 0 = basse (nuque couverte), 1 = haute (nuque dégagée). */
    napeHairline: Unit.default(0.5),
  })
  .strict();
export type SkullParams = z.infer<typeof SkullParams>;

export interface V2 { readonly x: number; readonly y: number }
/** Point de contour : `s` ∈ [0,1] = acuité (0 = lissé, 1 = angle vif), `id` = repère nommé (vérification, ancrage de détails). */
export interface CPoint extends V2 { readonly s?: number; readonly id?: string }
