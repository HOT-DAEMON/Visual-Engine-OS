import { z } from 'zod';
import { Slug, Unit } from './primitives';
import { MaterialRef } from './color-material';
import { Transform } from './light-transform';
import { Place } from './host';

/**
 * Œil composé (insecte) : dôme couvert de facettes hexagonales, chacune légèrement teintée et
 * dotée de son propre reflet. Structurellement différent de `eye` (pas de paupière, pas d'iris
 * unique) : un archétype à part entière, pas une variante paramétrique de l'œil anime.
 */
export const CompoundEyeSpec = z
  .object({
    kind: z.literal('compound_eye'),
    id: Slug,
    transform: Transform.default({}),
    /** Diamètre total du dôme. */
    size: z.number().min(10).max(4000).default(200),
    /** Rayon d'une facette, en fraction du rayon du dôme (petit = beaucoup de facettes). */
    facetRadius: z.number().min(0.04).max(0.35).default(0.11),
    material: MaterialRef.default({ preset: 'satin', color: '#2f6b4f' }),
    /** Variation de teinte aléatoire entre facettes voisines (0 = uniforme, 1 = très marquée). */
    tint: Unit.default(0.35),
    seed: z.number().int().min(0).max(0xffffffff).default(1),
    place: Place.optional(),
  })
  .strict();
export type CompoundEyeSpec = z.infer<typeof CompoundEyeSpec>;
