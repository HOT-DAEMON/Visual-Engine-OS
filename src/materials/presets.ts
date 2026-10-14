import type { MaterialDescriptor } from '../schema';

export const PRESET_NAMES = [
  'matte',
  'satin',
  'glossy_wet',
  'polished_metal',
  'waxed_metal',
  'emissive',
] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

interface PresetParams {
  readonly metallic: number;
  readonly roughness: number;
  readonly clearcoat: number;
  readonly emission?: number;
}

/**
 * Ces valeurs sont des CHOIX DE CONCEPTION, pas des constantes physiques mesurées.
 * - polished_metal : métal quasi-miroir (rugosité très faible).
 * - waxed_metal    : métal + fine couche de cire => reflet plus doux ET léger clearcoat.
 *                    (« métal ciré » est interprété ainsi ; à ajuster si ton sens diffère.)
 * - glossy_wet     : diélectrique brillant/humide (cornée, vernis).
 */
export const PRESET_PARAMS: Readonly<Record<PresetName, PresetParams>> = {
  matte: { metallic: 0, roughness: 0.85, clearcoat: 0 },
  satin: { metallic: 0, roughness: 0.45, clearcoat: 0 },
  glossy_wet: { metallic: 0, roughness: 0.15, clearcoat: 0.8 },
  polished_metal: { metallic: 1, roughness: 0.08, clearcoat: 0 },
  waxed_metal: { metallic: 1, roughness: 0.35, clearcoat: 0.25 },
  emissive: { metallic: 0, roughness: 0.6, clearcoat: 0, emission: 0.8 },
};

export function resolvePreset(ref: { preset: PresetName; color: string }): MaterialDescriptor {
  const p = PRESET_PARAMS[ref.preset];
  return {
    base: { type: 'solid', color: ref.color },
    metallic: p.metallic,
    roughness: p.roughness,
    clearcoat: p.clearcoat,
    opacity: 1,
    ...(p.emission === undefined ? {} : { emission: { color: ref.color, intensity: p.emission } }),
  };
}
