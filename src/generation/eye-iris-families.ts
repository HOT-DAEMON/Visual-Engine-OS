import type { EyeInput } from './random-eye-helpers';

/**
 * FAMILLES D'IRIS issues des références (references/eyes) — construites UNIQUEMENT avec les systèmes existants (`iris.layers`, `highlights.list`),
 * pas de moteur propre à une référence. Les proportions viennent de references/eyes/measures.json ; les teintes sont des interprétations
 * artistiques des couleurs relevées (palette de l'iris : or/orange pour 06 et 10a, turquoise-vert pour 07, prisme pour 04, bleu glacé pour 09,
 * orange -> vert pour 11).
 *
 * Mesures reprises : pupille / iris = 0,13–0,28 (`PUPIL_OVER_IRIS`) ; reflet principal r/iris = 0,22–0,29 et secondaire 0,09–0,15
 * (`HIGHLIGHT_OVER_IRIS`) ; limbe sombre marqué (`limbalRing` ≥ 0,6). Vérifiées par tests/eye-gallery-ext.test.ts.
 */
export const IRIS_FAMILIES = ['golden', 'teal-gem', 'prism', 'frost', 'ember', 'amber-radial'] as const;
export type IrisFamily = (typeof IRIS_FAMILIES)[number];
export const PUPIL_OVER_IRIS = [0.2, 0.34] as const;
export const HIGHLIGHT_OVER_IRIS = { primary: [0.2, 0.3], secondary: [0.08, 0.15] } as const;

type Layers = NonNullable<NonNullable<EyeInput['iris']>['layers']>;
type Highlights = NonNullable<NonNullable<EyeInput['highlights']>['list']>;

const LAYERS: Record<IrisFamily, Layers> = {
  // 06 : or incandescent, anneau clair autour de la pupille, trame fine
  golden: [{ color: '#7a3d08', color2: '#f2a81d', gradient: 'radial', opacity: 1 }, { color: '#fff1a8', mask: 'ring', inner: 0.22, outer: 0.5, glow: 0.45, feather: 0.4, irregularity: 0.6 }, { color: '#ffd24a', mask: 'ring', inner: 0.62, outer: 0.9, irregularity: 0.8, opacity: 0.55 }],
  // 07 : vert-turquoise, moitié basse plus lumineuse (bulles de cristal = taches claires)
  'teal-gem': [{ color: '#0b5f52', color2: '#1fb58f', gradient: 'radial', opacity: 1 }, { color: '#c7ff7a', color2: '#3de0a6', mask: 'half', angleDeg: 180, gradient: 'radial', inner: 0.1, feather: 0.55, opacity: 0.8 }, { color: '#e8ffd0', mask: 'spot', angleDeg: 150, inner: 0.5, outer: 0.7, spotRadius: 0.16, opacity: 0.7 }, { color: '#e8ffd0', mask: 'spot', angleDeg: 215, inner: 0.45, outer: 0.7, spotRadius: 0.12, opacity: 0.6 }],
  // 04 : prisme turquoise / magenta / jaune, rayons autour de la pupille
  prism: [{ color: '#0f9d92', color2: '#d9c63a', gradient: 'radial', opacity: 1 }, { color: '#d94fd0', mask: 'ring', inner: 0.5, outer: 0.85, irregularity: 0.9, feather: 0.7, opacity: 0.42, glow: 0.3 }, { color: '#7af0e0', mask: 'ring', inner: 0.25, outer: 0.55, irregularity: 0.8, feather: 0.6, opacity: 0.4 }, { color: '#ffb23a', mask: 'ring', inner: 0.14, outer: 0.34, glow: 0.5, irregularity: 0.5, opacity: 0.8 }],
  // 09 : bleu glacé, dentelle claire, limbe marine
  frost: [{ color: '#0b2f8f', color2: '#3fa3ff', gradient: 'radial', opacity: 1 }, { color: '#bfeaff', mask: 'ring', inner: 0.3, outer: 0.78, irregularity: 0.9, glow: 0.5, opacity: 0.7, feather: 0.35 }, { color: '#ffffff', mask: 'spot', angleDeg: 20, inner: 0.55, outer: 0.75, spotRadius: 0.1, opacity: 0.6 }],
  // 10a : anneau orange incandescent sur fond marine / violet
  ember: [{ color: '#1a1650', color2: '#5a3aa8', gradient: 'radial', opacity: 1 }, { color: '#ff7a1a', mask: 'ring', inner: 0.28, outer: 0.5, glow: 0.8, feather: 0.25, irregularity: 0.5 }, { color: '#ffd27a', mask: 'ring', inner: 0.44, outer: 0.52, glow: 0.7, feather: 0.2 }],
  // 11 : orange au centre, vert-turquoise au limbe, fibres radiales
  'amber-radial': [{ color: '#f0a01c', color2: '#0f8f78', gradient: 'radial', opacity: 1 }, { color: '#ff6a1a', mask: 'ring', inner: 0.14, outer: 0.42, irregularity: 0.7, opacity: 0.8 }],
};

/** Reflets : le reflet physique suit la lumière (taille mesurée) ; un éclat « sparkle » à l'ancre de l'iris pour les familles les plus lumineuses. */
const sparkle = (x: number, y: number, size: number): Highlights[number] => ({ shape: 'sparkle', anchor: 'iris', x, y, size, intensity: 0.8, confine: 'iris' }) as Highlights[number];

export function irisFamily(f: IrisFamily, rnd: () => number): { layers: Layers; highlights: Highlights } {
  const lerp = (r: readonly [number, number]): number => r[0] + rnd() * (r[1] - r[0]);
  const list: Highlights = [{ kind: 'reflection', size: lerp(HIGHLIGHT_OVER_IRIS.primary) }, { kind: 'reflection', role: 'secondary', size: lerp(HIGHLIGHT_OVER_IRIS.secondary), opacity: 0.7 }] as Highlights;
  if (f === 'prism' || f === 'frost' || f === 'ember' || f === 'golden') list.push(sparkle(-0.3 + rnd() * 0.1, -0.32 + rnd() * 0.1, 0.2 + rnd() * 0.1));
  return { layers: LAYERS[f], highlights: list };
}
