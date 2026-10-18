import { HAIR_FRINGES, HAIR_TEXTURES, HAIRLINES, SIDEBURNS, type FaceHair, type FaceParamsInput } from '../schema';
import { drawBrowLash, drawEyelidFold, type BrowLash, type EyelidFold } from './random-axes';
import { hslToHex } from './palette';
import { maybe, pick, range } from './random-eye-helpers';
import { drawHairV2 } from './random-hair-v2';

/** Couleur de cheveux : naturelle (pondérée), grise/blanche, ou vive (anime). Continue, pas un catalogue. */
export function drawHairColor(rnd: () => number): string {
  const r = rnd();
  if (r < 0.62) return hslToHex(range(rnd, 15, 38), range(rnd, 0.25, 0.6), range(rnd, 0.07, 0.3)); // noir → châtain
  if (r < 0.76) return hslToHex(range(rnd, 28, 48), range(rnd, 0.4, 0.75), range(rnd, 0.35, 0.62)); // blond → roux clair
  if (r < 0.82) return hslToHex(range(rnd, 8, 20), range(rnd, 0.6, 0.8), range(rnd, 0.3, 0.45)); // roux
  if (r < 0.92) return hslToHex(range(rnd, 200, 240), range(rnd, 0.02, 0.1), range(rnd, 0.6, 0.88)); // gris / blanc
  return hslToHex(range(rnd, 0, 360), range(rnd, 0.6, 0.9), range(rnd, 0.42, 0.62)); // vif
}

export interface ExtrasOptions {
  /** 'v2' (défaut) : tire aussi les axes du moteur de cheveux v2 (formes, franges, côtés, étages, apparence…) ; 'classic' : seeds d'avant. */
  readonly hairEngine?: 'v2' | 'classic';
  /** Autorise des occlusions du visage tirées au hasard (v2). */
  readonly occlusions?: boolean;
}

export type ExtrasOverride = Partial<Pick<FaceParamsInput, 'neck' | 'hair' | 'facialHair' | 'asymmetry'>>;

/** Tirage pondéré : `weights[i]` est la part de `options[i]`. Un seul tirage de `rnd`. */
function weighted<T>(rnd: () => number, options: readonly T[], weights: readonly number[]): T {
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return options[i] as T;
  }
  return options[options.length - 1] as T;
}

export interface Extras extends Required<ExtrasOverride> {
  readonly fold: EyelidFold;
  readonly browLash: BrowLash;
}

/**
 * Cou, cheveux, pilosité, asymétrie, pli de l'œil, sourcils/cils. Ordre de tirage FIXE et APRÈS tous les autres
 * tirages du visage : proportions, peau, expression et yeux d'une seed existante ne changent pas. Chaque axe
 * (coiffure, TEXTURE, implantation, couleur, barbe, pli…) est tiré séparément : aucun n'en déduit un autre.
 */
export function drawFaceExtras(rnd: () => number, override: ExtrasOverride = {}, options: ExtrasOptions = {}): Extras {
  const style = pick<FaceHair['style']>(rnd, ['bald', 'buzz', 'short', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'long', 'ponytail', 'ponytail', 'bun', 'braids']);
  const color = drawHairColor(rnd);
  const hair = {
    style,
    color,
    fringe: style === 'buzz' || style === 'bald' ? ('none' as const) : pick(rnd, HAIR_FRINGES),
    volume: rnd(),
    length: rnd(),
    hairline: rnd(),
    part: maybe(rnd, 0.6) ? range(rnd, -1, 1) : 0,
    sideburns: rnd(),
    seed: Math.floor(rnd() * 0xffffffff),
  };
  const neck = { visible: true, width: range(rnd, 0.3, 0.6), length: range(rnd, 0.14, 0.26), flare: range(rnd, 0.1, 0.4), shade: range(rnd, 0.3, 0.8) };
  const has = maybe(rnd, 0.3);
  const facialHair = {
    mustache: has && maybe(rnd, 0.6) ? pick<'thin' | 'full' | 'handlebar' | 'pencil'>(rnd, ['thin', 'full', 'handlebar', 'pencil']) : ('none' as const),
    beard: has ? pick<'stubble' | 'short' | 'full' | 'long' | 'goatee'>(rnd, ['stubble', 'short', 'full', 'long', 'goatee']) : ('none' as const),
    length: rnd(),
    density: range(rnd, 0.4, 1),
    color: null,
    seed: Math.floor(rnd() * 0xffffffff),
  };
  const sign = (): number => (rnd() < 0.5 ? -1 : 1);
  const asymmetry = {
    eyeScale: sign() * range(rnd, 0.01, 0.06),
    eyeOpenness: sign() * range(rnd, 0.02, 0.12),
    eyeRollDeg: sign() * range(rnd, 0.3, 2.2),
    eyeDy: sign() * range(rnd, 0.001, 0.007),
    mouthTiltDeg: sign() * range(rnd, 0.3, 2.5),
  };
  // --- Nouveaux axes (tirés après tout le reste) -------------------------------------------------------------
  const texture = weighted(rnd, HAIR_TEXTURES, [30, 25, 20, 15, 10]);
  const hairNew = {
    texture,
    curl: rnd(),
    hairlineShape: weighted(rnd, HAIRLINES, [50, 20, 15, 15]),
    recession: maybe(rnd, 0.3) ? range(rnd, 0.3, 1) : range(rnd, 0, 0.2),
    irregularity: range(rnd, 0.05, 0.6),
    thinning: maybe(rnd, 0.2) ? range(rnd, 0.15, 0.9) : 0,
    density: range(rnd, 0.4, 1),
    densityVariance: rnd(),
    lengthVariance: range(rnd, 0.15, 0.7),
    partWidth: range(rnd, 0.1, 0.7),
    highlight: range(rnd, 0.15, 0.7),
    rootColor: maybe(rnd, 0.15) ? hslToHex(range(rnd, 15, 40), range(rnd, 0.1, 0.4), range(rnd, 0.1, 0.45)) : null,
    tie: { height: rnd(), side: maybe(rnd, 0.45) ? sign() * range(rnd, 0.5, 1) : 0, tail: rnd(), thickness: rnd(), double: maybe(rnd, 0.3) },
    braids: { count: pick(rnd, [1, 2, 2, 2, 3, 4, 5, 6] as const), thickness: rnd() },
  };
  const facialNew = {
    sideburns: weighted(rnd, SIDEBURNS, [70, 12, 10, 8]),
    transition: rnd(),
    patchiness: maybe(rnd, 0.3) ? range(rnd, 0.2, 0.7) : 0,
  };
  const fold = drawEyelidFold(rnd);
  const browLash = drawBrowLash(rnd, (override.hair?.color as string | undefined) ?? color);
  // Axes v2 : tirés en TOUT dernier (ordre fixe) pour ne rien changer aux tirages précédents d'une seed existante.
  const v2 = options.hairEngine === 'classic' ? {} : drawHairV2(rnd, { style, color, texture }, { occlusions: options.occlusions });
  return {
    neck: { ...neck, ...override.neck },
    hair: { ...hair, ...hairNew, ...v2, ...override.hair },
    facialHair: { ...facialHair, ...facialNew, ...override.facialHair },
    asymmetry: { ...asymmetry, ...override.asymmetry },
    fold,
    browLash,
  };
}
