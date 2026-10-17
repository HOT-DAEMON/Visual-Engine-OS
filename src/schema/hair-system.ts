import { z } from 'zod';
import { Unit } from './primitives';

/**
 * Vocabulaire du système capillaire. SILHOUETTE (`HAIR_STYLES`) et TEXTURE (`HAIR_TEXTURES`) sont deux axes
 * INDÉPENDANTS : n'importe quelle texture s'applique à n'importe quelle coiffure. `'auto'` reproduit l'ancien
 * couplage historique (curly → bouclé, afro → crépu, le reste → raide).
 */
export const HAIR_STYLES = ['bald', 'buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'] as const;
export const HAIR_FRINGES = ['none', 'straight', 'sweep', 'curtain'] as const;
export const HAIR_TEXTURES = ['straight', 'wavy', 'curly', 'coily', 'braided'] as const;
export const HAIR_TEXTURE_CHOICES = [...HAIR_TEXTURES, 'auto'] as const;
export const HAIRLINES = ['round', 'straight', 'widow', 'receding'] as const;

/** Point d'attache (queue, chignon). Position relative au crâne : jamais de coordonnée absolue. */
export const HairTie = z
  .object({
    /** 0 = bas de la nuque, 1 = sommet du crâne (au-dessus du crâne si ≥ ~0,75). */
    height: Unit.default(0.8),
    /** -1 / +1 : attache sur le côté de l'image ; 0 : centrée derrière la tête. */
    side: z.number().min(-1).max(1).default(0),
    /** Longueur de la queue (ponytail) ou des tresses. */
    tail: Unit.default(0.6),
    /** Épaisseur de la queue / diamètre du chignon. */
    thickness: Unit.default(0.5),
    /** Deux attaches symétriques (couettes, double chignon). */
    double: z.boolean().default(false),
  })
  .strict();

export const HairBraids = z
  .object({
    /** Nombre de tresses pendantes (style `braids`). */
    count: z.number().int().min(1).max(6).default(2),
    /** Épaisseur d'une tresse. */
    thickness: Unit.default(0.5),
  })
  .strict();

export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairTextureChoice = (typeof HAIR_TEXTURE_CHOICES)[number];
export type HairTexture = (typeof HAIR_TEXTURES)[number];
export type HairlineShape = (typeof HAIRLINES)[number];
