import { darken } from '../core/color';
import { HAIR_FRINGES, type FaceHair, type FaceParamsInput } from '../schema';
import { hslToHex } from './palette';
import { maybe, pick, range } from './random-eye-helpers';

/** Couleur de cheveux : naturelle (pondérée), grise/blanche, ou vive (anime). Continue, pas un catalogue. */
export function drawHairColor(rnd: () => number): string {
  const r = rnd();
  if (r < 0.62) return hslToHex(range(rnd, 15, 38), range(rnd, 0.25, 0.6), range(rnd, 0.07, 0.3)); // noir → châtain
  if (r < 0.76) return hslToHex(range(rnd, 28, 48), range(rnd, 0.4, 0.75), range(rnd, 0.35, 0.62)); // blond → roux clair
  if (r < 0.82) return hslToHex(range(rnd, 8, 20), range(rnd, 0.6, 0.8), range(rnd, 0.3, 0.45)); // roux
  if (r < 0.92) return hslToHex(range(rnd, 200, 240), range(rnd, 0.02, 0.1), range(rnd, 0.6, 0.88)); // gris / blanc
  return hslToHex(range(rnd, 0, 360), range(rnd, 0.6, 0.9), range(rnd, 0.42, 0.62)); // vif
}

export type ExtrasOverride = Partial<Pick<FaceParamsInput, 'neck' | 'hair' | 'facialHair' | 'asymmetry'>>;

/**
 * Cou, cheveux, pilosité, asymétrie. Ordre de tirage FIXE et APRÈS tous les autres tirages du visage :
 * les proportions, la peau, l'expression et les yeux d'une seed existante ne changent pas.
 */
export function drawFaceExtras(rnd: () => number, override: ExtrasOverride = {}): Required<ExtrasOverride> & { browColor: string } {
  const style = pick<FaceHair['style']>(rnd, ['bald', 'buzz', 'short', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'long']);
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
    mustache: has && maybe(rnd, 0.6) ? pick<'thin' | 'full' | 'handlebar'>(rnd, ['thin', 'full', 'handlebar']) : ('none' as const),
    beard: has ? pick<'stubble' | 'goatee' | 'full'>(rnd, ['stubble', 'goatee', 'full']) : ('none' as const),
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
  return {
    neck: { ...neck, ...override.neck },
    hair: { ...hair, ...override.hair },
    facialHair: { ...facialHair, ...override.facialHair },
    asymmetry: { ...asymmetry, ...override.asymmetry },
    // Sourcils : même famille de teinte que les cheveux (enfants cohérents du même visage), un peu plus sombre.
    browColor: darken((override.hair?.color as string | undefined) ?? color, 0.12),
  };
}
