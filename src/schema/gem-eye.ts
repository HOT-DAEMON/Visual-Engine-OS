import { z } from 'zod';
import { Hex, Slug, Unit } from './primitives';
import { MaterialRef } from './color-material';
import { Transform } from './light-transform';
import { Place } from './host';
import { Shape } from './eye-shape';

/**
 * Œil de gemme (cristal) : la même enveloppe palpébrale que l'œil anime (`eye-shape.ts`, réutilisée
 * telle quelle), mais l'iris est remplacé par un disque de facettes triangulaires façon pierre
 * taillée — pas d'iris/pupille au sens optique, un rendu volontairement différent.
 */
export const GemEyeSpec = z
  .object({
    kind: z.literal('gem_eye'),
    id: Slug,
    transform: Transform.default({}),
    shape: Shape.default({}),
    sclera: MaterialRef.default({ preset: 'matte', color: '#fbf8f3' }),
    /** Couleur de base de la gemme (les facettes en sont des variations éclaircies/assombries). */
    gemColor: Hex.default('#5b3fd0'),
    /** Nombre de quartiers radiaux (chacun divisé en 2 facettes : interne et externe). */
    facets: z.number().int().min(6).max(24).default(12),
    /** Force du reflet unique façon « étincelle » au centre de la gemme. */
    sparkle: Unit.default(0.8),
    place: Place.optional(),
  })
  .strict();
export type GemEyeSpec = z.infer<typeof GemEyeSpec>;
