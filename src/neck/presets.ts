import { FaceNeck } from '../schema';

/**
 * PRESETS DU COU (docs/NECK-PRESETS.md) : des cous COMPLETS nommés, exprimés dans les paramètres EXISTANTS (`FaceNeck` + `NeckSystem`) : ni nouveau champ, ni second chemin de
 * rendu. Un preset est une donnée : `applyNeckPreset` la valide par le schéma du cou (donc par les mêmes bornes, corrections et contrôles que tout cou). Chaque preset est
 * PROUVÉ distinct des autres par `tests/neck-presets.test.ts` (écart de silhouette de face ou de pixels de la boîte du cou) ; un preset qui ne se distingue d'aucun autre est un
 * doublon et fait échouer le test. Les presets « créature » (reptile, oiseau, serpent, dragon, cuirassé) servent à des hôtes non humains.
 */
export type NeckPresetFamily = 'human' | 'stylized' | 'creature';
export interface NeckPreset { readonly id: string; readonly family: NeckPresetFamily; readonly label: string; readonly neck: Readonly<Record<string, unknown>> }

const sys = (system: Record<string, unknown>, flat: Record<string, unknown> = {}): Record<string, unknown> => ({ ...flat, system });

export const NECK_PRESETS: readonly NeckPreset[] = [
  { id: 'human-average', family: 'human', label: 'adulte moyen', neck: sys({ modifiers: { mass: 0.35, age: 0.4 }, musculature: { tension: 0.4 } }) },
  { id: 'human-slender', family: 'human', label: 'long et fin', neck: sys({ modifiers: { mass: 0.1, age: 0.3 }, musculature: { trapezius: 0.15, tendonVisibility: 0.5 } }, { width: 0.3, length: 0.4, flare: 0.12, muscles: 0.3 }) },
  { id: 'human-athletic', family: 'human', label: 'athlétique', neck: sys({ modifiers: { mass: 0.3, age: 0.3 }, musculature: { trapezius: 0.9, tension: 0.7, separation: 0.8 } }, { width: 0.52, length: 0.17, flare: 0.38, muscles: 0.9 }) },
  { id: 'human-thick-short', family: 'human', label: 'épais et court', neck: sys({ modifiers: { mass: 0.85, age: 0.5 }, softTissue: { foldDepth: 0.6, foldDistribution: 0.4 } }, { width: 0.62, length: 0.09, flare: 0.3, muscles: 0.3 }) },
  { id: 'human-elderly', family: 'human', label: 'âgé', neck: sys({ modifiers: { mass: 0.3, age: 1 }, softTissue: { dewlap: 0.55, foldDepth: 0.7, foldDistribution: 0.8 }, musculature: { tendonVisibility: 0.85, tension: 0.5 } }, { width: 0.4, length: 0.3, muscles: 0.5 }) },
  { id: 'human-child', family: 'human', label: 'enfant', neck: sys({ modifiers: { mass: 0.3, age: 0 }, musculature: { trapezius: 0.05, tension: 0.2 } }, { width: 0.36, length: 0.12, flare: 0.1, muscles: 0.1, thickness: 0.2 }) },
  { id: 'stylized-swan', family: 'stylized', label: 'cou de cygne', neck: sys({ modifiers: { mass: 0.05 }, profile: { sCurve: 0.3, curvature: 0.2 }, style: { mode: 'caricature', exaggeration: 0.5 } }, { width: 0.24, length: 0.8, flare: 0.1, muscles: 0.1 }) },
  { id: 'stylized-bull', family: 'stylized', label: 'cou de taureau', neck: sys({ modifiers: { mass: 0.7 }, musculature: { trapezius: 1, tension: 0.8 }, style: { mode: 'caricature', exaggeration: 0.8 } }, { width: 0.72, length: 0.12, flare: 0.55, muscles: 0.9 }) },
  { id: 'creature-serpent', family: 'creature', label: 'serpent', neck: sys({ species: 'serpent', profile: { segments: 8, sCurve: 0.25 }, surface: { pattern: 'scales' } }, { width: 0.3, length: 0.9 }) },
  { id: 'creature-avian', family: 'creature', label: 'oiseau', neck: sys({ species: 'avian', profile: { curvature: 0.2 } }, { width: 0.26, length: 0.55 }) },
  { id: 'creature-reptile', family: 'creature', label: 'reptile', neck: sys({ species: 'reptile', surface: { pattern: 'scales' } }, { width: 0.5, length: 0.25, flare: 0.3 }) },
  { id: 'creature-dragon', family: 'creature', label: 'dragon', neck: sys({ species: 'dragon', surface: { pattern: 'scales' } }, { width: 0.56, length: 0.6, flare: 0.4 }) },
  { id: 'creature-armored', family: 'creature', label: 'cuirassé', neck: sys({ species: 'armored', surface: { pattern: 'plates' } }, { width: 0.5, length: 0.2 }) },
];

/** Données DÉCLARÉES d'un preset (sans les défauts du schéma) : c'est ce que fusionne le générateur aléatoire, pour ne pas écraser ses tirages par des défauts. */
export function neckPresetPatch(id: string): Record<string, unknown> {
  const p = NECK_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Preset de cou inconnu : ${id} (connus : ${neckPresetIds().join(', ')})`);
  return { ...p.neck, visible: true };
}

export const neckPresetIds = (): string[] => NECK_PRESETS.map((p) => p.id);

/** Cou d'un preset (VISIBLE), validé par `FaceNeck` ; `overrides` (même forme que `FaceNeck`) l'emporte champ à champ, `system` fusionné en profondeur d'un niveau. */
export function applyNeckPreset(id: string, overrides: Record<string, unknown> = {}): FaceNeck {
  const p = NECK_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Preset de cou inconnu : ${id} (connus : ${neckPresetIds().join(', ')})`);
  const bs = (p.neck.system ?? {}) as Record<string, unknown>, os = (overrides.system ?? {}) as Record<string, unknown>;
  const merged: Record<string, Record<string, unknown> | unknown> = { ...bs };
  for (const [k, v] of Object.entries(os)) merged[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof bs[k] === 'object' ? { ...(bs[k] as object), ...(v as object) } : v;
  return FaceNeck.parse({ ...p.neck, ...overrides, visible: true, system: merged });
}
