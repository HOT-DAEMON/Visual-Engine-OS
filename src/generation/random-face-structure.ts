import { mulberry32 } from '../core/prng';
import type { FaceParamsInput } from '../schema';
import { deepMerge } from './random-face-anatomy';
import { maybe, range } from './random-eye-helpers';

/**
 * Tirage des axes du MOTEUR DE STRUCTURE (T1–T13) d'un visage aléatoire. Flux de tirage DÉRIVÉ de la seed (`seed ^ STRUCTURE_SALT`) :
 * activer la structure ne déplace aucun tirage existant (les visages `classic` restent identiques seed pour seed).
 * Les plages sont celles de variations humaines plausibles (pas les bornes du schéma) : le tirage ne produit jamais un cas limite par hasard.
 */
const STRUCTURE_SALT = 0x5bd1e995;

export interface StructureOverride {
  /** Surcharge profonde appliquée APRÈS les tirages (ex. `{ mandible: { bodyCurve: 0.1 } }`). */
  readonly patch?: FaceParamsInput;
}

export function drawStructure(seed: number, over: StructureOverride = {}): FaceParamsInput {
  const rnd = mulberry32((seed ^ STRUCTURE_SALT) >>> 0);
  const r = (lo: number, hi: number): number => range(rnd, lo, hi);
  const drawn: FaceParamsInput = {
    anatomyEngine: 'structured',
    mandible: { bodyCurve: r(0.25, 0.75), depth: r(0.3, 0.8), lowerBorder: r(0.25, 0.8), preauricular: r(0.3, 0.8) },
    softTissue: { masseter: { volume: r(0, 0.45), relief: r(0.2, 0.7) }, fat: r(0, 0.4), perioral: r(0.3, 0.7) },
    cheek: { volume: r(0.3, 0.7), boneProjection: r(0.3, 0.75), lateralWidth: r(0.3, 0.7), hollow: r(0.15, 0.55), masseterBlend: r(0.3, 0.7), elasticity: r(0.35, 0.7), perioralFold: r(0.15, 0.5) },
    chin: { dimple: maybe(rnd, 0.2) ? r(0.3, 0.8) : 0, groove: maybe(rnd, 0.15) ? r(0.3, 0.7) : 0, upperBlend: r(0.3, 0.7), lateralBlend: r(0.3, 0.7), lowerBlend: r(0.3, 0.7) },
    neck: { cervicomentalDeg: r(100, 130), thickness: r(0.15, 0.5), muscles: r(0.3, 0.7), platysma: r(0.25, 0.6) },
    mouth: { cupid: { depth: r(0.3, 0.8), width: r(0.3, 0.7), tubercle: r(0.2, 0.6) }, cornerAsym: r(-0.35, 0.35), lineWave: r(0, 0.45), teeth: { upper: r(0.5, 0.8), lower: r(0.3, 0.6) }, gums: r(0.1, 0.5), tongue: r(0.25, 0.6), cavity: r(0.45, 0.8), cornerFolds: r(0.2, 0.6), fit: r(0, 0.5) },
    nose: { sidewall: { slope: r(0.3, 0.7), concavity: r(0.15, 0.55) }, domes: { prominence: r(0.3, 0.7), separation: r(0.15, 0.5) }, groove: { depth: r(0.3, 0.7), length: r(0.4, 0.8) }, base: { width: r(-0.3, 0.4), depth: r(0.3, 0.7) }, columella: { hang: r(-0.3, 0.4) }, philtrum: { depth: r(0.25, 0.6), width: r(0.35, 0.65), blend: r(0.3, 0.7) } },
  };
  return deepMerge(drawn, over.patch);
}
