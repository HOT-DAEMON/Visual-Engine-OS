import { z } from 'zod';
import { Unit } from './primitives';
import { MaterialRef } from './color-material';

/**
 * Un groupe de cils (haut OU bas) couvre trois familles de paramètres, directement inspirées de
 * la morphologie réelle d'un cil :
 *  - MORPHOLOGIE du groupe : épaisseur/longueur de base, arche (où et comme le groupe culmine le
 *    long du bord), angle global, pointe (tête large → queue effilée), courbure.
 *  - FIBRES : dispersion statistique entre cils individuels (longueur, épaisseur, orientation,
 *    courbure, répartition) — c'est ce qui évite un peigne parfaitement régulier.
 *  - APPARENCE : couleur/matériau, opacité, variation de luminosité d'un cil à l'autre, brillance.
 *
 * Deux simplifications assumées (pas de faux paramètres qui ne feraient rien) :
 *  - « angle » et « inclinaison » sont UN SEUL champ (`angleDeg`) : les deux mots désignent la
 *    même rotation globale, les dupliquer n'ajouterait aucun effet visuel distinct.
 *  - « rugosité » n'est pas un champ séparé de « brillance » (`gloss`) : un cil est un trait fin,
 *    pas une surface ; la rugosité y est déjà l'inverse de la netteté du liseré de brillance.
 */
function lashGroup(maxCount: number, defaults: { count: number; length: number; thickness: number }) {
  return z
    .object({
      // --- Morphologie ---------------------------------------------------------------------
      count: z.number().int().min(0).max(maxCount).default(defaults.count),
      /** Longueur maximale (au pic de l'arche), en fraction de la hauteur de l'œil. */
      length: z.number().min(0.02).max(0.6).default(defaults.length),
      /** Épaisseur à la base (tête), en fraction de l'épaisseur du bord palpébral. */
      thickness: z.number().min(0.1).max(1.5).default(defaults.thickness),
      /** Courbure globale (recourbement vers le haut en pointe). */
      curl: Unit.default(0.6),
      /** Éventail : inclinaison (degrés) des cils externes par rapport à la normale du bord. */
      sweep: z.number().min(0).max(60).default(25),
      /** Rotation additionnelle uniforme de tout le groupe (angle = inclinaison, un seul champ). */
      angleDeg: z.number().min(-45).max(45).default(0),
      /** 0 = pointe arrondie (tête ≈ queue), 1 = pointe très effilée (aiguille). */
      tipSharpness: Unit.default(0.6),
      arch: z
        .object({
          /** Position du pic de longueur le long du bord : 0 = canthus interne, 1 = externe. */
          peak: Unit.default(0.72),
          /** Largeur du pic : étroit (pic marqué) → large (profil presque plat). */
          width: z.number().min(0.1).max(1).default(0.32),
          /** Amplitude du pic : 0 = longueur uniforme, 1 = contraste marqué base/pic. */
          strength: Unit.default(0.6),
        })
        .strict()
        .default({}),
      // --- Fibres (dispersion statistique, seedée) ------------------------------------------
      lengthVariation: Unit.default(0.2),
      thicknessVariation: Unit.default(0.15),
      /** Dispersion d'orientation entre cils, en degrés. */
      orientationVariation: z.number().min(0).max(20).default(4),
      curlVariation: Unit.default(0.15),
      /** Dispersion de la répartition des cils le long du bord (0 = régulier, 1 = très irrégulier). */
      positionDispersion: Unit.default(0.3),
      // --- Apparence -------------------------------------------------------------------------
      /** null : hérite de la couleur de la paupière (`lids.material`), comportement historique. */
      material: MaterialRef.nullable().default(null),
      opacity: Unit.default(1),
      /** Variation de luminosité (clair/sombre) d'un cil à l'autre. */
      colorVariation: Unit.default(0.15),
      /** Liseré plus clair du côté éclairé de chaque cil (0 = désactivé). */
      gloss: Unit.default(0),
      // --- Travail du cil (opt-in : 0 = comportement historique) ------------------------------
      /** Allongement des cils de la partie EXTERNE : jusqu'à +`outerLength` × la longueur au canthus externe. */
      outerLength: z.number().min(0).max(2).default(0),
      /**
       * Redresse les cils de la moitié externe vers le HAUT de l'œil (0 = suivent la normale de la
       * paupière, qui plonge à l'extérieur ; 1 = presque verticaux au canthus externe).
       */
      outerLift: Unit.default(0),
      /** Mèches : 0 = cils indépendants ; 1 = cils regroupés en pointe par paquets de `clumpSize`. */
      clump: Unit.default(0),
      clumpSize: z.number().int().min(2).max(6).default(3),
    })
    .strict();
}

/**
 * Cils longs du canthus externe (opt-in, `count` = 0 : aucun). Ce sont des cils supplémentaires,
 * plantés sur les derniers `reach` du bord supérieur, orientés comme l'aile du liner (relevés de
 * `liftDeg` par rapport à l'horizontale de l'œil), le plus externe étant le plus long, et
 * recourbés en fin de course.
 */
export const LashFlick = z
  .object({
    count: z.number().int().min(0).max(8).default(0),
    /** Longueur du plus long, en fraction de la hauteur de l'œil. */
    length: z.number().min(0.15).max(1.5).default(0.5),
    /** Portion du bord supérieur (depuis le canthus externe) où ils prennent racine. */
    reach: z.number().min(0.04).max(0.35).default(0.14),
    liftDeg: z.number().min(-10).max(80).default(32),
    curl: Unit.default(0.7),
  })
  .strict();

export const LashesUpper = lashGroup(60, { count: 16, length: 0.22, thickness: 0.5 }).extend({ flick: LashFlick.default({}) });
export const LashesLower = lashGroup(30, { count: 6, length: 0.09, thickness: 0.4 }).extend({ opacity: Unit.default(0.8) });

export const Lashes = z.object({ upper: LashesUpper.default({}), lower: LashesLower.default({}) }).strict();
