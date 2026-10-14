import { z } from 'zod';
import { PRESET_NAMES, resolvePreset } from '../materials/presets';
import { Hex, Unit } from './primitives';

/**
 * Couleurs et matériaux : le contrat entre un objet de scène et le système de matériaux partagé
 * (voir src/materials/). Un matériau s'écrit soit en descripteur complet, soit en raccourci
 * `{preset, color}` résolu vers un descripteur complet (voir materials/presets.ts).
 */

export const Stop = z.object({ offset: Unit, color: Hex, opacity: Unit.default(1) }).strict();
export const Stops = z
  .array(Stop)
  .min(2)
  .max(8)
  .refine((s) => s.every((st, i) => i === 0 || st.offset >= (s[i - 1]?.offset ?? 0)), {
    message: 'les offsets des stops doivent être croissants',
  });

/**
 * linear.angleDeg : 0° = de haut en bas, 90° = de gauche à droite.
 */
export const ColorSource = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: Hex }).strict(),
  z.object({ type: z.literal('linear'), angleDeg: z.number().min(0).max(360), stops: Stops }).strict(),
  z.object({ type: z.literal('radial'), stops: Stops }).strict(),
]);
export type ColorSource = z.infer<typeof ColorSource>;

export const MaterialDescriptor = z
  .object({
    base: ColorSource,
    metallic: Unit.default(0),
    roughness: Unit.default(0.5),
    clearcoat: Unit.default(0),
    emission: z.object({ color: Hex, intensity: Unit }).strict().optional(),
    opacity: Unit.default(1),
  })
  .strict();
export type MaterialDescriptor = z.infer<typeof MaterialDescriptor>;

export const PresetRef = z.object({ preset: z.enum(PRESET_NAMES), color: Hex }).strict();

/** Un matériau s'écrit soit en descripteur complet, soit en `{preset, color}`. */
export const MaterialRef = z.union([MaterialDescriptor, PresetRef.transform(resolvePreset)]);
