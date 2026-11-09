import { z } from 'zod';
import { Hex, Slug } from './primitives';
import { Transform } from './light-transform';
import { SkullParams } from '../skull/types';
import { DERIVED_AXES } from '../skull/derive';

/**
 * TÊTE DE PROFIL (crâne + nuque + visage de profil) d'un hôte `shape: 'face'` : c'est la MÊME personne vue de côté.
 * Contrat : le profil ne porte aucune forme libre. Le crâne est DÉRIVÉ des paramètres du visage de l'hôte (largeur → indice céphalique → longueur,
 * front, pommettes, cou : `skull/derive.ts`) ; `skull` ne fournit que les axes que le visage ne détermine pas (occiput, inion, maxillaire, C7…) et
 * `variation` la petite variation libre BORNÉE des axes dérivés. `transform` PLACE le profil dans la scène (son repère natif a une hauteur de 420).
 */
const Free = z.number().min(-1).max(1);
/** Variation libre bornée de la dérivation du crâne (partagée avec `head_3d` : même contrat, une seule définition). */
export const SkullVariation = z.object({ ci: Free.default(0), axes: z.object(Object.fromEntries(DERIVED_AXES.map((k) => [k, Free.optional()])) as Record<(typeof DERIVED_AXES)[number], z.ZodOptional<z.ZodNumber>>).strict().default({}) }).strict().default({});
export const HeadProfileSpec = z
  .object({
    kind: z.literal('head_profile'),
    id: Slug,
    /** Identifiant de l'hôte-visage dont ce profil est la vue latérale. */
    host: Slug,
    /** Axes que le visage ne détermine pas ; les axes dérivés (length, vaultHeight, frontalBulge, foreheadSlope, zygoma, neckDepth) sont ÉCRASÉS par la dérivation. */
    skull: SkullParams.partial().default({}),
    /** Variation libre bornée de la dérivation : `ci` (indice céphalique, ±2,5 points) et les 5 axes dérivés (±0,08). 0 = aucune variation. */
    variation: SkullVariation,
    /** Couleur des cheveux ; par défaut celle du visage de l'hôte. */
    hair: Hex.optional(),
    /** `skin` = rendu final ; `anatomy` = muscles/ligaments ; `bone` = os seul. */
    mode: z.enum(['skin', 'anatomy', 'bone']).default('skin'),
    /** Placement du profil dans la scène (repère natif : H = 420). */
    transform: Transform.default({}),
  })
  .strict();
export type HeadProfileSpec = z.infer<typeof HeadProfileSpec>;
