import { z } from 'zod';
import { Hex, Unit } from './primitives';
import { MaterialRef } from './color-material';

/**
 * Liner ailé (opt-in, `null` par défaut = rendu historique inchangé). Un trait de liner posé sur la
 * paupière supérieure : fin au départ, de plus en plus épais vers le canthus externe, prolongé par
 * une aile (flick) effilée au-delà du canthus. Quand il est actif, il REMPLACE `lids.wing`
 * (l'ancienne pointe simple) et les cils supérieurs prennent racine sur son bord haut.
 */
export const Liner = z
  .object({
    /** null : couleur de la paupière (`lids.material`). */
    color: Hex.nullable().default(null),
    /** null : couleur unie ; sinon dégradé `color` → `tipColor` le long du liner jusqu'à la pointe. */
    tipColor: Hex.nullable().default(null),
    /** Épaisseur maximale AJOUTÉE au bord palpébral, en multiples de `lids.thickness`. */
    thickness: z.number().min(0.1).max(4).default(1.1),
    /** Où le liner commence le long du bord supérieur (0 = canthus interne, 1 = externe). */
    start: z.number().min(0).max(0.9).default(0.12),
    /** Où il atteint son épaisseur maximale. */
    peak: z.number().min(0.2).max(1).default(0.82),
    wing: z
      .object({
        /** Longueur de l'aile au-delà du canthus externe, en fraction de la largeur de l'œil. */
        length: z.number().min(0).max(1.5).default(0.3),
        /** Relèvement de l'aile par rapport à l'HORIZONTALE de l'œil (vers l'extérieur), en degrés. */
        liftDeg: z.number().min(-20).max(70).default(20),
        /** > 0 : l'aile se redresse en fin de course (virgule, jusqu'à +28°) ; < 0 : elle retombe. */
        curve: z.number().min(-1).max(1).default(0.3),
        /** 0 : extrémité arrondie ; 1 : pointe d'aiguille. */
        sharpness: Unit.default(0.85),
        /** Épaisseur de l'aile à sa naissance, relative à celle du liner au canthus. */
        thickness: z.number().min(0.1).max(1.5).default(0.95),
      })
      .strict()
      .default({}),
    /** Liner inférieur fin : part du canthus externe et remonte le long du bord bas (0 = aucun). */
    lowerReach: Unit.default(0),
    /** Brillance : trait clair le long du bord haut du liner (0 = mat). */
    gloss: Unit.default(0.3),
    opacity: Unit.default(1),
  })
  .strict();

export const Lids = z
  .object({
    /** Couleur du bord libre (paupière). Le trait est plat : pas d'ombrage. */
    material: MaterialRef.default({ preset: 'matte', color: '#1a1420' }),
    thickness: z.number().min(0.01).max(0.2).default(0.06),
    /** Pointe au canthus externe (trait effilé). */
    wing: Unit.default(0.5),
    /** Pli palpébral supérieur. height = 0 : pas de pli (paupière sans pli). */
    crease: z
      .object({
        height: z.number().min(0).max(0.6).default(0.2),
        depth: Unit.default(0.5),
      })
      .strict()
      .default({}),
    /** Ligne humide du bord palpébral inférieur (0 = invisible). */
    waterline: Unit.default(0.4),
    /** Liner ailé — voir `Liner`. null : aucun (comportement historique). */
    liner: Liner.nullable().default(null),
  })
  .strict();
