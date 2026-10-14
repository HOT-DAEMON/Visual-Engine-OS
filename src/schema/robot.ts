import { z } from 'zod';
import { Hex, Slug, Unit } from './primitives';
import { MaterialRef } from './color-material';
import { Transform } from './light-transform';
import { Gaze } from './eye-gaze-expression';
import { Place } from './host';

export const RobotHousing = z
  .object({
    ringWidth: z.number().min(0.08).max(0.4).default(0.22),
    material: MaterialRef.default({ preset: 'polished_metal', color: '#aeb8c4' }),
    bolts: z.number().int().min(0).max(12).default(4),
  })
  .strict();

export const RobotLens = z
  .object({
    /** Teinte du traitement antireflet sur le bord de la lentille. */
    tint: Hex.default('#5b3fd0'),
    rings: z.number().int().min(0).max(5).default(3),
    /** Rayon de l'ouverture, en fraction du rayon de la lentille. */
    aperture: z.number().min(0.2).max(0.75).default(0.5),
    gloss: Unit.default(0.85),
    reticle: z.boolean().default(true),
  })
  .strict();

export const RobotSensor = z
  .object({
    color: Hex.default('#3ee0ff'),
    intensity: Unit.default(0.85),
    /** Rayon du capteur, en fraction du rayon de la lentille (doit tenir dans l'ouverture). */
    size: z.number().min(0.06).max(0.5).default(0.2),
  })
  .strict();

export const RobotEyeSpec = z
  .object({
    kind: z.literal('robot_eye'),
    id: Slug,
    transform: Transform.default({}),
    /** Diamètre extérieur du boîtier. */
    size: z.number().min(20).max(4000).default(200),
    housing: RobotHousing.default({}),
    lens: RobotLens.default({}),
    sensor: RobotSensor.default({}),
    gaze: Gaze.default({}),
    place: Place.optional(),
  })
  .strict();
export type RobotEyeSpec = z.infer<typeof RobotEyeSpec>;
