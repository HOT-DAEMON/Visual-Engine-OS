import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * CONTRAT DU MATÉRIAU DE PEAU (`src/skin/`).
 *
 * Principe directeur : Rendu = f(géométrie, matériaux, éclairage, caméra). Ce contrat est la partie MATÉRIAU :
 * il décrit des propriétés de SURFACE (rugosité par région, reflet diélectrique, diffusion sous-cutanée, grain), et NE
 * contient AUCUNE coordonnée, AUCUNE forme, AUCUNE identité de personnage. Les régions sont nommées (front, nez, joues…) ;
 * leur position et leur taille viennent de la géométrie (`face/regions.ts`), la lumière vient de l'éclairage.
 * Le même matériau s'applique donc à n'importe quelle géométrie, et une géométrie se rend dans plusieurs styles.
 * Il n'y a volontairement PAS de champ `metallic` : la peau est un diélectrique (reflet blanc, jamais teinté de métal).
 */

/** Rugosité (0 = lisse/brillant, 1 = très rugueux/mat) PAR RÉGION : la rugosité de la peau varie, elle n'est pas uniforme. */
export const SkinRoughness = z
  .object({
    forehead: Unit.default(0.42),
    nose: Unit.default(0.34),
    cheeks: Unit.default(0.62),
    temples: Unit.default(0.58),
    chin: Unit.default(0.5),
    upperLip: Unit.default(0.55),
    neck: Unit.default(0.68),
  })
  .strict();

export const SkinSpecular = z
  .object({
    /** Intensité globale du reflet (0 = peau mate sans reflet). */
    strength: Unit.default(0.5),
    /** Largeur des reflets : 0 = étroits, 1 = très larges et diffus (jamais métalliques). */
    broadness: Unit.default(0.6),
    /** Reflet de Fresnel : éclaircissement des bords vus à angle rasant. */
    fresnel: Unit.default(0.3),
    /** Part de la couleur de peau dans la couleur du reflet (0 = reflet de la couleur de la lumière, valeur physique d'un diélectrique). */
    tint: Unit.default(0.06),
  })
  .strict();

export const SkinSubsurface = z
  .object({
    /** Force de la diffusion sous-cutanée (rougeur chaude de la transition lumière → ombre). */
    strength: Unit.default(0.45),
    /** Couleur de diffusion ; `null` = dérivée de la peau (sang sous la peau). */
    color: Hex.nullable().default(null),
    /** Largeur de la zone de diffusion le long du terminateur. */
    width: Unit.default(0.5),
  })
  .strict();

export const SKIN_MODELS = ['skin', 'legacy'] as const;

export const SkinMaterial = z
  .object({
    /** `skin` : matériau de peau de ce contrat ; `legacy` : ancien ombrage générique (`compileSurface`), conservé pour comparaison. */
    model: z.enum(SKIN_MODELS).default('skin'),
    roughness: SkinRoughness.default({}),
    specular: SkinSpecular.default({}),
    subsurface: SkinSubsurface.default({}),
    /** Douceur de la transition lumière → ombre : 0 = franche, 1 = très progressive. */
    softness: Unit.default(0.6),
    /** Brillance grasse de la zone T (front, nez, menton) : multiplie le reflet de ces régions. */
    oiliness: Unit.default(0.3),
    /** Micro-relief (pores, grain) : visible surtout dans les régions rugueuses. */
    pores: Unit.default(0.25),
  })
  .strict();

export type SkinMaterial = z.infer<typeof SkinMaterial>;
export type SkinMaterialInput = z.input<typeof SkinMaterial>;
export const SKIN_REGIONS = ['forehead', 'nose', 'cheeks', 'temples', 'chin', 'upperLip', 'neck'] as const;
export type SkinRegionId = (typeof SKIN_REGIONS)[number];
