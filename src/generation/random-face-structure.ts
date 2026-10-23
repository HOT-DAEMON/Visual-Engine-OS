import { mulberry32 } from '../core/prng';
import type { FaceParamsInput } from '../schema';
import { deepMerge } from './random-face-anatomy';
import { maybe, range } from './random-eye-helpers';
import { STYLIZATION_PROFILES, type StylizationProfileName } from '../face/stylize/profiles';

/**
 * Tirage des axes du MOTEUR DE STRUCTURE (T1–T13) d'un visage aléatoire. Flux de tirage DÉRIVÉ de la seed (`seed ^ STRUCTURE_SALT`) :
 * activer la structure ne déplace aucun tirage existant (les visages `classic` restent identiques seed pour seed).
 * Les plages sont celles de variations humaines plausibles (pas les bornes du schéma) : le tirage ne produit jamais un cas limite par hasard.
 */
const STRUCTURE_SALT = 0x5bd1e995;

export interface StructureOverride {
  /** Surcharge profonde appliquée APRÈS les tirages (ex. `{ mandible: { bodyCurve: 0.1 } }`). */
  readonly patch?: FaceParamsInput;
  /**
   * Tirage OPTIONNEL des familles B/C/stylisation (flux dérivé distinct : activer l'une ne déplace aucun autre tirage, et sans cette option
   * les visages structurés sont identiques seed pour seed). `deform` : articulation légère + une expression ; `stylization` : un profil nommé.
   */
  readonly draw?: { readonly deform?: boolean; readonly stylization?: boolean; readonly ears?: boolean };
}

const DRAW_SALT = 0x9e3779b1;
const EXPRESSION_AXES = ['smile', 'grimace', 'anger', 'surprise', 'disgust', 'disdain', 'ooh'] as const;

/** Tirage de `deform` : valeurs de variation humaine ordinaire (jamais les bornes), UNE expression dominante d'intensité modérée. */
function drawDeform(seed: number): FaceParamsInput {
  const rnd = mulberry32((seed ^ DRAW_SALT) >>> 0);
  const r = (lo: number, hi: number): number => range(rnd, lo, hi);
  const axis = EXPRESSION_AXES[Math.floor(rnd() * EXPRESSION_AXES.length)] as (typeof EXPRESSION_AXES)[number];
  const expression: Record<string, number> = { [axis]: axis === 'smile' ? r(-0.4, 0.8) : r(0.2, 0.7) };
  if (maybe(rnd, 0.1)) expression.caricature = r(0.1, 0.4);
  return { deform: { articulation: { jawShift: r(-0.25, 0.25), protrusion: r(-0.25, 0.25), headPitchDeg: r(-8, 8), clench: r(0, 0.35) }, expression } } as FaceParamsInput;
}

const EAR_SALT = 0x2c1b3c6d;
/** Écart signé quasi gaussien (somme de deux uniformes), borné à ±0,8 : les extrêmes du schéma ne sortent jamais par hasard. */
const signed = (rnd: () => number, scale: number): number => Math.max(-0.8, Math.min(0.8, (rnd() + rnd() - 1) * scale));

/**
 * Tirage OPTIONNEL du moteur d'oreille (`draw.ears`) : famille (humaine très majoritaire) + déviations morphologiques modérées. Flux dérivé distinct
 * (`seed ^ EAR_SALT`) : sans l'option, les visages sont identiques seed pour seed ; avec elle, aucun autre tirage ne bouge.
 */
function drawEars(seed: number): FaceParamsInput {
  const rnd = mulberry32((seed ^ EAR_SALT) >>> 0);
  const u = rnd();
  const family = u < 0.86 ? 'human' : u < 0.95 ? 'elven' : 'feline';
  const g = (): number => signed(rnd, 1.1);
  const morph = {
    pole: { height: g(), round: g(), lean: g() * 0.6, tip: family === 'human' ? g() * 0.3 : g() },
    posterior: { convexity: g() },
    width: g() * 0.7,
    lobule: { length: g(), width: g(), attach: g(), sag: g() * 0.7 },
    tragus: { size: g() * 0.7, projection: g() * 0.7 },
    antitragus: { size: g() * 0.7, orientation: g() * 0.7 },
    notch: { depth: g() * 0.7 },
    helix: { thickness: g(), roll: g() },
    antihelix: { relief: g() * 0.7, branchAngle: g() * 0.7, upperLength: g() * 0.7, lowerLength: g() * 0.7 },
    concha: { depth: g() * 0.7, cymba: g() * 0.7 },
    scapha: { width: g() * 0.7, depth: g() * 0.7 },
    crus: { thickness: g() * 0.7 },
  };
  return { ears: { family, morph } } as FaceParamsInput;
}

/** Tirage de la stylisation : un profil nommé (le profil `realiste`, neutre, reste le plus fréquent : 2 parts sur 7). */
function drawStylization(seed: number): FaceParamsInput {
  const rnd = mulberry32((seed ^ DRAW_SALT ^ 0x51ed270b) >>> 0);
  const names = ['realiste', 'realiste', ...(Object.keys(STYLIZATION_PROFILES).filter((n) => n !== 'realiste') as StylizationProfileName[])];
  return STYLIZATION_PROFILES[names[Math.floor(rnd() * names.length)] as StylizationProfileName] as FaceParamsInput;
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
  const withDraw = deepMerge(deepMerge(drawn, over.draw?.deform ? drawDeform(seed) : undefined), over.draw?.stylization ? drawStylization(seed) : undefined);
  const withEars = over.draw?.ears ? deepMerge(withDraw, drawEars(seed)) : withDraw;
  return deepMerge(withEars, over.patch);
}
