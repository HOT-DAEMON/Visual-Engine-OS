import { z } from 'zod';
import { Hex, Num, Unit } from './primitives';

export const LightSpec = z
  .object({
    azimuthDeg: z.number().min(0).max(360).default(330),
    elevationDeg: z.number().min(10).max(90).default(55),
    color: Hex.default('#ffffff'),
    intensity: Unit.default(1),
  })
  .strict();
export type LightSpec = z.infer<typeof LightSpec>;

export const Transform = z
  .object({
    x: Num.min(-1e6).max(1e6).default(0),
    y: Num.min(-1e6).max(1e6).default(0),
    rotationDeg: z.number().min(-180).max(180).default(0),
    scale: z.number().min(0.05).max(20).default(1),
  })
  .strict();
export type Transform = z.infer<typeof Transform>;
