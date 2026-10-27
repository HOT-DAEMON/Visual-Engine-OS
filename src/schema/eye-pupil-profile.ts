import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * EYE-05 — Profils de pupille. Chaque sous-bloc a UN rôle (contrat TODO-EYES-SYSTEMS-2 §2.5) et une valeur
 * par défaut NEUTRE : un œil qui ne les mentionne pas est rendu exactement comme avant (voir `isLegacyPupil`).
 */

/** Formes de pupille : un PROFIL géométrique, pas une exception du moteur (même contrat que la pupille ronde). */
export const PUPIL_SHAPES = ['round', 'slit_vertical', 'slit_horizontal', 'star', 'diamond', 'polygon', 'cross', 'keyhole'] as const;

/** EYE-05G — Réponse lumineuse : dépend de l'ESPÈCE ou du style, jamais supposée universelle. */
export const PUPIL_RESPONSE_MODELS = ['fixed', 'circular', 'vertical_slit', 'horizontal_slit'] as const;
export const PupilResponse = z
  .object({
    /** `fixed` : la pupille ne réagit pas (valeur historique). Les autres modèles lisent `light`. */
    model: z.enum(PUPIL_RESPONSE_MODELS).default('fixed'),
    /** Niveau de lumière ambiante vu par l'œil : 0 = obscurité (dilatation), 0,5 = neutre (taille nominale), 1 = éblouissement. */
    light: Unit.default(0.5),
  })
  .strict();

/** EYE-05F — Bord de transition : netteté (flou du contour) et coloration (liseré teinté autour de la pupille). */
export const PupilEdge = z
  .object({
    softness: Unit.default(0),
    tint: Hex.nullable().default(null),
    /** Opacité du liseré teinté (sans effet si `tint` est null). */
    tintOpacity: Unit.default(0.55),
  })
  .strict();

/** Paramètres des profils à sommets : `star` (pointes), `polygon` (côtés), `cross` (épaisseur des bras). */
export const PupilLobes = z
  .object({
    /** Nombre de pointes (étoile) ou de côtés (polygone). */
    count: z.number().int().min(3).max(12).default(5),
    /** Étoile : rayon intérieur / extérieur. Croix : épaisseur des bras relative. */
    inner: z.number().min(0.12).max(0.9).default(0.45),
    /** 0 : sommets vifs ; 1 : sommets très arrondis (coupe de coins de Chaikin, 0 à 3 passes). */
    rounding: Unit.default(0),
  })
  .strict();

/** EYE-05H — Pupilles multiples : nombre, disposition, taille relative. */
export const PupilMultiple = z
  .object({
    count: z.number().int().min(1).max(5).default(1),
    layout: z.enum(['ring', 'line', 'stack']).default('ring'),
    /** Écartement des pupilles par rapport au centre, relatif au rayon de l'iris. */
    spread: z.number().min(0.1).max(0.8).default(0.45),
    /** Taille de chaque pupille relativement à la pupille seule. */
    scale: z.number().min(0.25).max(1).default(0.55),
  })
  .strict();

/** EYE-05J — Déformation locale : écrasement, cisaillement, irrégularité du contour (harmoniques à graine, lisses). */
export const PupilDeform = z
  .object({
    /** > 0 : écrasée verticalement (largeur compensée) ; < 0 : étirée. */
    squash: z.number().min(-0.5).max(0.5).default(0),
    skew: z.number().min(-0.5).max(0.5).default(0),
    irregularity: Unit.default(0),
  })
  .strict();

/** EYE-05E — Centre pupillaire : décalage relatif au rayon de l'iris (l'iris reste centré sur le globe). */
export const PupilCenter = z
  .object({ x: z.number().min(-0.35).max(0.35).default(0), y: z.number().min(-0.35).max(0.35).default(0) })
  .strict();
