import { mix } from '../core/color';
import { mulberry32 } from '../core/prng';
import type { AppearanceInput, FaceNoseInput, FaceLightingInput, FaceParamsInput, LightSpec, SkinMaterialInput } from '../schema';
import { maybe, range } from './random-eye-helpers';

/** Surcharges possibles de l'anatomie, de la peau et de l'éclairage d'un visage aléatoire (fusion profonde sur les tirages). */
export interface AnatomyOverride {
  readonly nose?: FaceNoseInput;
  readonly chin?: NonNullable<FaceParamsInput['chin']>;
  readonly jaw?: NonNullable<FaceParamsInput['jaw']>;
  readonly skinMaterial?: SkinMaterialInput;
  readonly lighting?: FaceLightingInput;
  readonly skin?: AppearanceInput;
  /** Style de rendu de la peau : `smooth` (défaut, transitions douces) ou `cel` (bords nets). */
  readonly style?: 'smooth' | 'cel';
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Fusion profonde : les objets sont fusionnés clé par clé, tout le reste (nombres, tableaux, null) est remplacé. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : over) as T;
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(out[k], v);
  return out as T;
}

/** Pondération : tire une valeur parmi `items` selon des poids relatifs. */
function weighted<T>(rnd: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return (items[items.length - 1] as readonly [T, number])[0];
}

/**
 * Tirages des NOUVEAUX axes du visage : nez (racine, dorsum, pointe, ailes, narines, raccords), menton, mâchoire, matériau de peau,
 * éclairage des composants et TOUS les axes de l'apparence de la peau. Le générateur est dérivé de la graine par un décalage fixe :
 * il ne consomme JAMAIS le flux des tirages existants, donc un visage garde ses proportions, ses yeux et ses cheveux d'avant.
 */
export function drawAnatomy(seed: number, skin: string, over: AnatomyOverride = {}): Pick<FaceParamsInput, 'nose' | 'chin' | 'jaw' | 'skinMaterial' | 'lighting' | 'skin'> {
  const r = mulberry32(((seed >>> 0) ^ 0x9e3779b1) >>> 0);
  const u = (lo: number, hi: number): number => range(r, lo, hi);
  // Dorsum : droit le plus souvent ; l'asymétrie reçoit une déviation d'un signe tiré au hasard.
  const shape = weighted(r, [['straight', 45], ['convex', 25], ['concave', 15], ['asymmetric', 15]] as const);
  const nose: FaceNoseInput = {
    root: { height: u(0.2, 0.8), depth: u(0.25, 0.75), width: u(0.3, 0.75) },
    dorsum: { shape, width: u(0.25, 0.75), curvature: u(0.3, 0.8), deviation: (maybe(r, 0.5) ? 1 : -1) * u(0.3, 0.8) },
    tip: { width: u(0.25, 0.75), roundness: u(0.2, 0.85), projection: u(0.25, 0.8), rotation: u(-0.5, 0.6), alarBlend: u(0.25, 0.8), highlight: u(0.35, 0.8) },
    alae: { thickness: u(0.25, 0.75), volume: u(0.3, 0.8), flare: u(0.25, 0.8), attachment: u(0.25, 0.8) },
    nostrils: { shape: u(0.3, 0.8), tiltDeg: u(12, 36), asymmetry: u(-0.3, 0.3), columella: u(0.3, 0.75), visibility: null },
    junction: { glabella: u(0.3, 0.8), orbital: u(0.3, 0.8), cheek: u(0.3, 0.8), nasolabial: u(0.2, 0.7) },
  };
  const chin = { height: u(0.085, 0.14), projection: u(0.2, 0.8), symphysis: weighted(r, [['round', 50], ['square', 20], ['pointed', 15], ['cleft', 15]] as const), cleft: u(0.3, 0.8), mentolabial: u(0.25, 0.65), pad: u(0.25, 0.65) };
  const jaw = { angle: u(0.15, 0.85), taper: u(0.25, 0.8), neckTransition: u(0.2, 0.8), submental: u(0, 0.35), mobility: u(0.3, 0.7), tissue: u(0.3, 0.7) };
  // Matériau de peau : une rugosité INDÉPENDANTE par région (la variation est le but), reflet large et non métallique.
  const skinMaterial: SkinMaterialInput = {
    roughness: { forehead: u(0.3, 0.55), nose: u(0.22, 0.5), cheeks: u(0.5, 0.75), temples: u(0.45, 0.7), chin: u(0.38, 0.62), upperLip: u(0.45, 0.65), neck: u(0.55, 0.8) },
    specular: { strength: u(0.3, 0.65), broadness: u(0.45, 0.8), fresnel: u(0.15, 0.45), tint: u(0, 0.12) },
    subsurface: { strength: u(0.3, 0.6), color: null, width: u(0.3, 0.7) },
    softness: u(0.45, 0.8),
    oiliness: u(0.1, 0.55),
    pores: u(0.1, 0.4),
  };
  const lighting: FaceLightingInput = {
    rims: { head: { intensity: u(0.15, 0.3) }, nose: { intensity: u(0.08, 0.18) }, ears: { intensity: u(0.12, 0.25) }, chin: { intensity: u(0.1, 0.2) }, neck: { intensity: u(0.1, 0.2) } },
    contacts: { master: u(0.6, 0.85), nose: { strength: u(0.4, 0.65) }, alae: { strength: u(0.4, 0.65) }, orbits: { strength: u(0.35, 0.6) }, ears: { strength: u(0.35, 0.6) }, jaw: { strength: u(0.45, 0.7) }, mouth: { strength: u(0.35, 0.6) }, hair: { strength: u(0.35, 0.6) } },
    zones: { forehead: { intensity: u(0.3, 0.6) }, nose: { intensity: u(0.25, 0.5) }, cheeks: { intensity: u(0.3, 0.6) }, shoulders: { intensity: u(0.2, 0.45) }, directionality: u(0.4, 0.8), softness: u(0.55, 0.85) },
  };
  // Apparence de la peau : TOUS les axes du contrat. Dégradé vertical (peau → plus chaude au milieu → peau), tons d'ombre/lumière/contour
  // parfois imposés, contraste/saturation/luminosité légers, reflet, grain, lueur et bloom discrets, réfraction quasi nulle.
  const warm = mix(skin, '#e08a78', 0.18);
  const skinAp: AppearanceInput = {
    light: { shadow: maybe(r, 0.3) ? mix(skin, '#7a4a5a', 0.35) : null, light: maybe(r, 0.25) ? mix(skin, '#fff1d8', 0.5) : null, rim: maybe(r, 0.25) ? '#ffe6cf' : null, rimStrength: u(0.15, 0.5), shadowShift: u(0.1, 0.55) },
    gradient: maybe(r, 0.45) ? [{ offset: 0, color: skin, opacity: 1 }, { offset: 0.55, color: warm, opacity: 1 }, { offset: 1, color: skin, opacity: 1 }] : [],
    texture: maybe(r, 0.35) ? { kind: 'grain', scale: u(0.3, 0.7), intensity: u(0.05, 0.2) } : { kind: 'none' },
    shading: { mode: 'smooth' },
    contrast: u(-0.1, 0.2),
    saturation: u(-0.1, 0.15),
    brightness: u(-0.05, 0.05),
    opacity: 1,
    emission: { color: null, intensity: 0 },
    reflection: { intensity: u(0.35, 0.65), size: u(0.35, 0.7), tint: null },
    refraction: { strength: maybe(r, 0.15) ? u(0.01, 0.04) : 0, scale: u(0.3, 0.7) },
    glow: maybe(r, 0.25) ? { color: null, radius: u(0.15, 0.35), intensity: u(0.03, 0.1) } : { color: null, radius: 0.3, intensity: 0 },
    bloom: maybe(r, 0.2) ? { radius: u(0.15, 0.35), intensity: u(0.03, 0.1), threshold: u(0.7, 0.9) } : { radius: 0.3, intensity: 0, threshold: 0.7 },
  };
  const styled: AnatomyOverride = over.style === 'cel' ? { ...over, skin: deepMerge({ shading: { mode: 'cel', bands: 3 } }, over.skin) as AppearanceInput } : over;
  return {
    nose: deepMerge(nose, styled.nose),
    chin: deepMerge(chin, styled.chin) as FaceParamsInput['chin'],
    jaw: deepMerge(jaw, styled.jaw) as FaceParamsInput['jaw'],
    skinMaterial: deepMerge(skinMaterial, styled.skinMaterial),
    lighting: deepMerge(lighting, styled.lighting),
    skin: deepMerge(skinAp, styled.skin),
  };
}

/**
 * Éclairage principal tiré pour une scène : direction (azimut, élévation), température de couleur, taille de la source, dureté des ombres.
 * Graine dérivée à part : ne touche à aucun autre tirage. `distance` reste `null` (source à l'infini) sauf demande.
 */
export function randomLight(seed: number): LightSpec {
  const r = mulberry32(((seed >>> 0) ^ 0x7f4a7c15) >>> 0);
  return {
    azimuthDeg: range(r, 0, 360),
    elevationDeg: range(r, 30, 75),
    color: '#ffffff',
    intensity: range(r, 0.8, 1),
    sourceSize: range(r, 0.3, 0.8),
    temperatureK: maybe(r, 0.6) ? range(r, 3800, 7500) : null,
    shadowHardness: range(r, 0.25, 0.7),
    distance: null,
    influence: { skin: 1, hair: 1, eyes: 1, lips: 1, metal: 1 },
  };
}
