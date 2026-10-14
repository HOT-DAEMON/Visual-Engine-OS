import { darken, lighten } from '../core/color';
import { mulberry32 } from '../core/prng';
import type { ColorSource } from '../schema';

/**
 * Convertit HSL (h en degrés, s/l en [0,1]) en #rrggbb. Implémentation standard, sans dépendance.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const H = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = l - c / 2;
  const [r0, g0, b0] =
    H < 60
      ? [c, x, 0]
      : H < 120
        ? [x, c, 0]
        : H < 180
          ? [0, c, x]
          : H < 240
            ? [0, x, c]
            : H < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to255 = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to255(r0)}${to255(g0)}${to255(b0)}`;
}

/** Familles d'iris humaines plausibles : plage de teinte et de luminosité typique (pas une norme, un point de départ). */
const IRIS_FAMILIES = [
  { name: 'brown', hue: [20, 35], sat: [0.45, 0.75], light: [0.14, 0.28], weight: 4 },
  { name: 'amber', hue: [35, 48], sat: [0.55, 0.8], light: [0.32, 0.45], weight: 2 },
  { name: 'hazel', hue: [55, 85], sat: [0.35, 0.55], light: [0.3, 0.42], weight: 2 },
  { name: 'green', hue: [95, 140], sat: [0.3, 0.55], light: [0.28, 0.4], weight: 1 },
  { name: 'gray', hue: [200, 220], sat: [0.05, 0.15], light: [0.55, 0.68], weight: 1 },
  { name: 'blue', hue: [200, 225], sat: [0.35, 0.65], light: [0.42, 0.6], weight: 2 },
] as const;

export interface IrisPaletteOptions {
  /** Restreint le tirage à ces familles (par nom). Non fourni : toutes, pondérées par `weight`. */
  readonly families?: readonly (typeof IRIS_FAMILIES)[number]['name'][];
}

/** Iris procédural (dégradé radial 3 tons) tiré déterministiquement d'une seed. */
export function generateIrisPalette(seed: number, options: IrisPaletteOptions = {}): ColorSource {
  const rnd = mulberry32(seed >>> 0);
  const pool = options.families
    ? IRIS_FAMILIES.filter((f) => options.families?.includes(f.name))
    : IRIS_FAMILIES;
  const list = pool.length > 0 ? pool : IRIS_FAMILIES;
  let totalWeight = 0;
  for (const f of list) totalWeight += f.weight;
  let pick = rnd() * totalWeight;
  let family: (typeof IRIS_FAMILIES)[number] = list[0] as (typeof IRIS_FAMILIES)[number];
  for (const f of list) {
    if (pick < f.weight) {
      family = f;
      break;
    }
    pick -= f.weight;
  }
  const hue = family.hue[0] + rnd() * (family.hue[1] - family.hue[0]);
  const sat = family.sat[0] + rnd() * (family.sat[1] - family.sat[0]);
  const light = family.light[0] + rnd() * (family.light[1] - family.light[0]);
  const mid = hslToHex(hue, sat, light);
  return {
    type: 'radial',
    stops: [
      { offset: 0, color: lighten(mid, 0.3 + 0.15 * rnd()), opacity: 1 },
      { offset: 0.55 + 0.1 * rnd(), color: mid, opacity: 1 },
      { offset: 1, color: darken(mid, 0.45 + 0.2 * rnd()), opacity: 1 },
    ],
  };
}

/** Familles connues, pour piloter `generateIrisPalette` (tests, UI). */
export const IRIS_FAMILY_NAMES = IRIS_FAMILIES.map((f) => f.name);
