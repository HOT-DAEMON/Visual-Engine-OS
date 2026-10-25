import { ContentCache } from '../perf';
import { fractalTile } from './turbulence';
import { encodeGrayPng, toBase64 } from './png';

/** Côté de la tuile en unités utilisateur (1 pixel par unité) : assez grand pour que la répétition ne se voie pas sur du grain fin. */
export const TILE_SIZE = 64;

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
 * Data-URI d'un PNG gris 64×64 : valeur = alpha que la matrice d'origine aurait calculé à partir de `feTurbulence`.
 * Remplace `feTurbulence + feColorMatrix` par `feImage + feTile` (voir docs/PERF-2.md pour la mesure).
 * Pure + mise en cache par contenu : une même (fréquence, graine) ne recalcule jamais la tuile.
 */
export function noiseTileHref(spec: NoiseTileSpec): string {
  const key = JSON.stringify([spec.freqX, spec.freqY, spec.octaves, spec.seed, spec.channel ?? 3, spec.offset, spec.gain]);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const raw = fractalTile({ freqX: spec.freqX, freqY: spec.freqY, octaves: spec.octaves, seed: spec.seed, size: TILE_SIZE }, spec.channel ?? 3);
  const g = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) g[i] = Math.round(Math.min(1, Math.max(0, spec.offset + spec.gain * (raw[i] as number))) * 255);
  // Le base64 d'un bruit contient au hasard « NaN » (≈ 2 % des tuiles) : les contrôles de validité du moteur et des tests cherchent cette
  // sous-chaîne dans le SVG entier. On décale donc l'alignement (bloc tEXt de remplissage) jusqu'à l'absence de « NaN » / « Infinity » ;
  // déterministe (mêmes entrées → même `pad`), au plus quelques essais.
  let href = '';
  for (let pad = 0; pad < 64; pad++) {
    const b64 = toBase64(encodeGrayPng(g, TILE_SIZE, TILE_SIZE, pad));
    href = `data:image/png;base64,${b64}`;
    if (!/NaN|Infinity/.test(b64)) break;
  }
  cache.set(key, href);
  return href;
}

/**
 * Primitives de filtre qui remplacent `feTurbulence` : `feImage` (la tuile, ancrée au coin de la région) puis `feTile` (répétition sur
 * toute la région). Sortie opaque en niveaux de gris : la valeur du canal vert est le « alpha » voulu ; l'appelant la lit avec
 * `LUMA_ROW` dans sa matrice de couleur (ligne alpha = luminance), ce qui reste exact en `color-interpolation-filters="sRGB"`.
 */
export function tiledNoiseNodes(spec: NoiseTileSpec, origin: { readonly x: number; readonly y: number }, result: string, el: (tag: string, a: Record<string, string | number>) => string): string[] {
  return [
    el('feImage', { href: noiseTileHref(spec), x: origin.x, y: origin.y, width: TILE_SIZE, height: TILE_SIZE, preserveAspectRatio: 'none', result: `${result}-t` }),
    el('feTile', { in: `${result}-t`, result }),
  ];
}
/** Ligne alpha d'une feColorMatrix qui lit la luminance (R,V,B opaques et égaux → luminance = valeur de la tuile). */
export const LUMA_ROW = '0.2126 0.7152 0.0722 0 0';
