import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * CONTRAT DU MOTEUR D'APPARENCE (`src/appearance/`).
 *
 * Un composant (parent, enfant ou frère : cheveux, pilosité, peau, cou…) ne choisit JAMAIS ses couleurs
 * ni ses effets lui-même : il fournit une couleur de base et reçoit un `ResolvedAppearance`. Tout ce qui
 * suit est optionnel ; `{}` signifie « dérive tout de la couleur de base » (le moteur calcule alors une
 * teinte d'ombre, une teinte de lumière et une lumière de contour cohérentes).
 *
 * Principe directeur : les couleurs sont définies PAR LA LUMIÈRE, pas par un teint unique. Trois entrées
 * indépendantes (`light.shadow`, `light.light`, `light.rim`) s'ajoutent à la couleur de base.
 */

/** Un arrêt de dégradé le long de la mèche (0 = racine, 1 = pointe). Plus de deux couleurs autorisées. */
export const AppearanceStop = z.object({ offset: Unit, color: Hex, opacity: Unit.default(1) }).strict();

/** Teintes de lumière indépendantes : ombre, lumière, contour. `null` = dérivée de la couleur de base. */
export const AppearanceLight = z
  .object({
    /** Teinte des ombres (proche de la couleur principale, tirée vers le bleu-violet par `shadowShift`). */
    shadow: Hex.nullable().default(null),
    /** Teinte des lumières et des reflets. */
    light: Hex.nullable().default(null),
    /** Lumière de contour : fin liseré sur le bord opposé à la lumière principale. */
    rim: Hex.nullable().default(null),
    rimStrength: Unit.default(0.35),
    /** Force du décalage de teinte des ombres dérivées (0 = ombre neutre, 1 = franchement bleutée). */
    shadowShift: Unit.default(0.35),
  })
  .strict();

export const TEXTURE_KINDS = ['none', 'grain', 'strands', 'dots', 'hatch'] as const;
export const AppearanceTexture = z
  .object({ kind: z.enum(TEXTURE_KINDS).default('none'), scale: Unit.default(0.5), intensity: Unit.default(0.3) })
  .strict();

export const SHADING_MODES = ['smooth', 'cel'] as const;
/** `cel` : 2 à 3 tons séparés par des bords NETS + bande de reflet blanche à contour dur. */
export const AppearanceShading = z
  .object({
    mode: z.enum(SHADING_MODES).default('smooth'),
    /** Nombre de tons en mode `cel` (2 : lumière + ombre ; 3 : + ombre propre au pied de la mèche). */
    bands: z.union([z.literal(2), z.literal(3)]).default(3),
    /** Largeur de la bande de reflet blanche (0 = aucune). */
    highlightBand: Unit.default(0),
    /** Ombre portée teintée d'une mèche sur celles qui sont dessous (0 = aucune). */
    castShadow: Unit.default(0),
  })
  .strict();

export const Appearance = z
  .object({
    light: AppearanceLight.default({}),
    /** Dégradé racine → pointe à N couleurs (vide = couleur de base seule). */
    gradient: z.array(AppearanceStop).max(8).default([]),
    texture: AppearanceTexture.default({}),
    shading: AppearanceShading.default({}),
    /** −1…1 : 0 neutre. Appliqués à toutes les couleurs résolues. */
    contrast: z.number().min(-1).max(1).default(0),
    saturation: z.number().min(-1).max(1).default(0),
    brightness: z.number().min(-1).max(1).default(0),
    opacity: Unit.default(1),
    emission: z.object({ color: Hex.nullable().default(null), intensity: Unit.default(0) }).strict().default({}),
    /** Reflet : intensité, taille, teinte (`null` = teinte de lumière dérivée). */
    reflection: z.object({ intensity: Unit.default(0.5), size: Unit.default(0.5), tint: Hex.nullable().default(null) }).strict().default({}),
    /** Réfraction : léger déplacement du fond vu à travers le matériau (translucidité). */
    refraction: z.object({ strength: Unit.default(0), scale: Unit.default(0.5) }).strict().default({}),
    glow: z.object({ color: Hex.nullable().default(null), radius: Unit.default(0.3), intensity: Unit.default(0) }).strict().default({}),
    /** Bloom : halo des zones les plus claires. */
    bloom: z.object({ radius: Unit.default(0.3), intensity: Unit.default(0), threshold: Unit.default(0.7) }).strict().default({}),
  })
  .strict();

export type Appearance = z.infer<typeof Appearance>;
export type AppearanceInput = z.input<typeof Appearance>;
