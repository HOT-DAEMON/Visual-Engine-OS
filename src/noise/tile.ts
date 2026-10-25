import { ContentCache } from '../perf';
import { fractalTile } from './turbulence';
import { encodeGrayPng, toBase64 } from './png';

/** Côté de la tuile en unités utilisateur (1 pixel par unité) : assez grand pour que la répétition ne se voie pas sur du grain fin. */
export const TILE_SIZE = 64;
/** Échantillons par unité de la tuile : 2 ⇒ image 128×128 pour 64 unités. Mesuré : à 1, le décalage sous-pixel lisse le grain (énergie 0,63–0,85 de la référence). */
export const TILE_RES = 2;
/**
 * Compensation d'atténuation : le grain est à une fréquence proche ou au-dessus de la limite de Nyquist du pixel (0,85–1,25 cycle/unité) ; le
 * rastériseur échantillonne `feTurbulence` aux pixels (valeurs quasi indépendantes) alors que la tuile est INTERPOLÉE à un décalage sous-pixel,
 * ce qui retire une part de l'énergie haute fréquence. Mesuré sur 24 rendus (scripts/verify-equivalence.ts) : énergie de grain 0,80–1,01 de la
 * référence sans compensation ; ce gain d'amplitude recentre le rapport (docs/PERF-2.md).
 */
export const RESAMPLE_GAIN = 1.15;

export interface NoiseTileSpec {
  readonly freqX: number;
  readonly freqY: number;
  readonly octaves: number;
  readonly seed: number;
  /** Canal de bruit lu par la matrice de couleur d'origine (3 = alpha). */
  readonly channel?: number;
  /** Valeur finale = clamp(offset + gain · somme) — reproduit la ligne alpha de la `feColorMatrix` d'origine. */
  readonly offset: number;
  readonly gain: number;
}

const cache = new ContentCache<string>('noiseTile', 64);

/**
 * Data-URI d'un PNG gris (64 unités × 2 échantillons par unité = 128×128) : valeur = alpha que la matrice d'origine aurait calculé à partir de `feTurbulence`.
 * Remplace `feTurbulence + feColorMatrix` par `feImage + feTile` (voir docs/PERF-2.md pour la mesure).
 * Pure + mise en cache par contenu : une même (fréquence, graine) ne recalcule jamais la tuile.
 */
export function noiseTileHref(spec: NoiseTileSpec): string {
  const key = JSON.stringify([TILE_RES, RESAMPLE_GAIN, spec.freqX, spec.freqY, spec.octaves, spec.seed, spec.channel ?? 3, spec.offset, spec.gain]);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const raw = fractalTile({ freqX: spec.freqX, freqY: spec.freqY, octaves: spec.octaves, seed: spec.seed, size: TILE_SIZE, res: TILE_RES }, spec.channel ?? 3);
  const g = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) g[i] = Math.round(Math.min(1, Math.max(0, spec.offset + spec.gain * RESAMPLE_GAIN * (raw[i] as number))) * 255);
  // Le base64 d'un bruit contient au hasard « NaN » (≈ 2 % des tuiles) : les contrôles de validité du moteur et des tests cherchent cette
  // sous-chaîne dans le SVG entier. On décale donc l'alignement (bloc tEXt de remplissage) jusqu'à l'absence de « NaN » / « Infinity » ;
  // déterministe (mêmes entrées → même `pad`), au plus quelques essais.
  let href = '';
  for (let pad = 0; pad < 64; pad++) {
    const b64 = toBase64(encodeGrayPng(g, TILE_SIZE * TILE_RES, TILE_SIZE * TILE_RES, pad));
    href = `data:image/png;base64,${b64}`;
    if (!/NaN|Infinity/.test(b64)) break;
  }
  cache.set(key, href);
  return href;
}

/** Mode de génération du bruit des filtres : `tile` (défaut, rapide) ou `turbulence` (référence de la spécification, lente). */
export type NoiseMode = 'tile' | 'turbulence';
let mode: NoiseMode = 'tile';
/** Change le mode (état de module, pour les bancs et la vérification d'équivalence). Rend l'ancien mode. */
export function setNoiseMode(m: NoiseMode): NoiseMode { const old = mode; mode = m; return old; }
export const getNoiseMode = (): NoiseMode => mode;

/** Ligne alpha d'une feColorMatrix qui lit la luminance (R,V,B opaques et égaux → luminance = valeur de la tuile). */
export const LUMA_ROW = '0.2126 0.7152 0.0722 0 0';

type ElFn = (tag: string, a: Record<string, string | number>) => string;
export interface NoiseSteps {
  /** Primitives à empiler (produisent le résultat nommé `result`). */
  readonly nodes: string[];
  /** Ligne alpha (5 nombres) de la feColorMatrix qui suit : fait de la sortie du bruit l'alpha voulu. */
  readonly alphaRow: string;
}

/**
 * Primitives de filtre produisant le bruit `spec` sous le nom `result`.
 *  - mode `tile` : `feImage` (tuile ancrée au coin de la région) + `feTile` (répétition) ; sortie opaque en gris, l'alpha voulu est la
 *    LUMINANCE (`LUMA_ROW`), exact en `color-interpolation-filters="sRGB"` ;
 *  - mode `turbulence` : `feTurbulence` d'origine ; l'alpha voulu est `offset + gain·(2A−1)` avec A le canal alpha du bruit.
 * Les deux donnent la même loi (même fréquence, même graine, mêmes octaves) ; seule la réalisation du bruit diffère (tuile périodique).
 */
export function noiseSteps(spec: NoiseTileSpec, origin: { readonly x: number; readonly y: number }, result: string, el: ElFn): NoiseSteps {
  if (mode === 'turbulence') {
    // alpha = offset + gain·sum et sum = 2A − 1  ⇒  alpha = (offset − gain) + 2·gain·A ; la matrice lit A (colonne alpha).
    const row = `0 0 0 ${String(Number((2 * spec.gain).toFixed(3)))} ${String(Number((spec.offset - spec.gain).toFixed(3)))}`;
    return { nodes: [el('feTurbulence', { type: 'fractalNoise', baseFrequency: `${String(spec.freqX)} ${String(spec.freqY)}`, numOctaves: spec.octaves, seed: spec.seed, result })], alphaRow: row };
  }
  return {
    nodes: [
      el('feImage', { href: noiseTileHref(spec), x: origin.x, y: origin.y, width: TILE_SIZE, height: TILE_SIZE, preserveAspectRatio: 'none', result: `${result}-t` }),
      el('feTile', { in: `${result}-t`, result }),
    ],
    alphaRow: LUMA_ROW,
  };
}
