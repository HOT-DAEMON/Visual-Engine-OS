import { darken, lighten, mix } from '../core/color';
import { hslToHex } from './palette';
import { range } from './random-eye-helpers';
import type { EyeInput } from './random-eye-helpers';

/**
 * AXES INDÉPENDANTS, jamais couplés à une origine : chacun est tiré séparément, aucun ne dérive d'un autre.
 * Une peau claire avec des cheveux crépus, une peau foncée avec des cheveux blonds raides, un œil sans pli
 * avec une peau olive… sont tous possibles. Coupler la morphologie à une origine mène à la caricature.
 */
export interface SkinAxes {
  /** 0 = très foncée, 1 = très claire. */
  readonly clarity: number;
  /** 0 = rosé, ⅓ = neutre/pêche, ⅔ = olive, 1 = doré. */
  readonly undertone: number;
  readonly color: string;
}

/** Ancres de sous-ton (teinte °, saturation) : rosé → neutre → olive → doré, interpolées en continu. */
const UNDERTONES: readonly (readonly [number, number])[] = [[6, 0.46], [22, 0.4], [46, 0.27], [38, 0.62]];

export function skinColor(clarity: number, undertone: number, jitter = 0): string {
  const f = Math.min(0.9999, Math.max(0, undertone)) * (UNDERTONES.length - 1);
  const i = Math.floor(f);
  const a = UNDERTONES[i] as readonly [number, number];
  const b = UNDERTONES[i + 1] as readonly [number, number];
  const hue = a[0] + (b[0] - a[0]) * (f - i);
  const sat = (a[1] + (b[1] - a[1]) * (f - i)) * (0.8 + 0.4 * (1 - Math.abs(2 * clarity - 1))) + jitter;
  return hslToHex(hue, Math.min(0.75, Math.max(0.15, sat)), 0.22 + 0.62 * clarity);
}

/** Trois tirages (comme l'ancienne teinte unique) : clarté, sous-ton, variation de saturation. */
export function drawSkinAxes(rnd: () => number): SkinAxes {
  const clarity = rnd();
  const undertone = rnd();
  const jitter = range(rnd, -0.04, 0.04);
  return { clarity, undertone, color: skinColor(clarity, undertone, jitter) };
}

/** Pli de l'œil : pli palpébral (0 = paupière sans pli) et pli épicanthique, indépendants de tout le reste. */
export interface EyelidFold {
  readonly crease: number;
  readonly depth: number;
  readonly epicanthic: number;
}

export function drawEyelidFold(rnd: () => number): EyelidFold {
  const mono = rnd() < 0.25;
  const crease = range(rnd, 0.08, 0.45);
  const depth = range(rnd, 0.3, 1);
  const epi = rnd() < 0.3;
  const amount = range(rnd, 0.2, 1);
  return { crease: mono ? 0 : crease, depth, epicanthic: epi ? amount : 0 };
}

/** Sourcils et cils : systèmes pileux DISTINCTS de la chevelure (teinte, densité, épaisseur, arche propres). */
export interface BrowLash {
  readonly browColor: string;
  readonly thickness: number;
  readonly hairs: number;
  readonly arch: number;
  readonly taper: number;
  readonly length: number;
  readonly lashScale: number;
  readonly lashDensity: number;
  readonly lashColor: string;
}

export function drawBrowLash(rnd: () => number, hairColor: string): BrowLash {
  const mode = rnd();
  const jitter = range(rnd, 0, 1);
  const browColor = mode < 0.6 ? darken(hairColor, 0.12) : mode < 0.8 ? darken(hairColor, 0.4) : mode < 0.9 ? lighten(hairColor, 0.25 + 0.2 * jitter) : hslToHex(210, 0.04, 0.45 + 0.4 * jitter);
  const lashDark = rnd() < 0.8;
  return {
    browColor,
    thickness: range(rnd, 0.06, 0.26),
    hairs: Math.round(range(rnd, 30, 150)),
    arch: rnd(),
    taper: range(rnd, 0.3, 1),
    length: range(rnd, 0.85, 1.35),
    lashScale: range(rnd, 0.6, 1.4),
    lashDensity: range(rnd, 0.6, 1.2),
    lashColor: lashDark ? darken(mix(browColor, '#1a1420', 0.6), 0.1) : mix(browColor, '#3a2a22', 0.3),
  };
}

type Eye = EyeInput & { kind: 'eye' };

/** Applique pli + sourcils + cils à un œil AVANT l'ajustement à l'orbite (ils changent son empreinte). L'expression (inclinaison, froncement) est conservée. */
export function applyEyeAxes(eye: Eye, fold: EyelidFold, bl: BrowLash): Eye {
  const lids = { ...eye.lids, crease: { ...eye.lids?.crease, height: fold.crease, depth: fold.depth } };
  const up = eye.lashes?.upper;
  const lashes = up ? { ...eye.lashes, upper: { ...up, length: Math.min(0.6, Math.max(0.05, (up.length ?? 0.22) * bl.lashScale)), count: Math.min(60, Math.max(4, Math.round((up.count ?? 16) * bl.lashDensity))), material: { preset: 'matte' as const, color: bl.lashColor } } } : eye.lashes;
  const eyebrow = eye.eyebrow ? { ...eye.eyebrow, thickness: bl.thickness, hairs: bl.hairs, arch: bl.arch, taper: bl.taper, length: bl.length, material: { preset: 'matte' as const, color: bl.browColor } } : eye.eyebrow;
  return { ...eye, lids, lashes, eyebrow, epicanthicFold: { ...eye.epicanthicFold, amount: fold.epicanthic } } as Eye;
}
