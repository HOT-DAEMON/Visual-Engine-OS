import { Resvg } from '@resvg/resvg-js';

/**
 * RASTÉRISATION D'UNE CELLULE — deux qualités, un cache.
 * Mesuré (cellule 03, 288 px, 1 cœur) : `final` (anticrénelage) ≈ 7,3 ms ; `draft` (`shapeRendering: 0`, sans anticrénelage) ≈ 2,2 ms, soit 3,3× plus vite,
 * au prix de contours crénelés → à réserver aux aperçus / vignettes de galerie, jamais aux artefacts de preuve.
 * Le cache est indexé par (SVG, largeur, qualité) : un SVG de profil est constant, donc un 2ᵉ appel coûte une recherche de table.
 */
export type RasterQuality = 'draft' | 'final';
export interface Raster { readonly width: number; readonly height: number; readonly rgba: Uint8Array }
const CACHE = new Map<string, Raster>(); const CACHE_MAX = 64;
let hits = 0; let misses = 0;
export const rasterCacheStats = (): { hits: number; misses: number; size: number } => ({ hits, misses, size: CACHE.size });
export function rasterize(svg: string, widthPx: number, quality: RasterQuality = 'final'): Raster {
  const key = `${quality}|${widthPx}|${svg.length}|${svg}`;
  const hit = CACHE.get(key);
  if (hit) { hits++; return hit; }
  misses++;
  const img = new Resvg(svg, { font: { loadSystemFonts: false }, shapeRendering: quality === 'draft' ? 0 : 2, fitTo: { mode: 'width', value: widthPx } }).render();
  const out: Raster = { width: img.width, height: img.height, rgba: new Uint8Array(img.pixels) };
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, out);
  return out;
}
