import type { Raster } from './png';

/**
 * Mesures de différence entre deux images de même taille. Toutes sont des GRANDEURS OBSERVABLES sur les pixels (pas un jugement) :
 *  - `rms` : écart quadratique moyen sur les canaux RGB (0–255) — mesure globale, insensible à quelques pixels isolés ;
 *  - `maxDiff` : plus grand écart d'un canal sur toute l'image ;
 *  - `fracOver(t)` : part des pixels dont au moins un canal diffère de plus de `t` — détecte un déplacement localisé que le RMS dilue ;
 *  - `lumaGrid` : luminance moyenne par case d'une grille (signature compacte d'une image, pour comparer des variations).
 */
export interface DiffStats { readonly rms: number; readonly maxDiff: number; readonly fracOver8: number; readonly fracOver32: number }

export function diffStats(a: Raster, b: Raster): DiffStats {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`images de tailles différentes : ${a.width}×${a.height} ≠ ${b.width}×${b.height}`);
  const n = a.width * a.height;
  let sq = 0; let max = 0; let o8 = 0; let o32 = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(a.data[i * 4 + c]! - b.data[i * 4 + c]!); sq += d * d; if (d > m) m = d; }
    if (m > max) max = m; if (m > 8) o8++; if (m > 32) o32++;
  }
  return { rms: Math.sqrt(sq / (3 * n)), maxDiff: max, fracOver8: o8 / n, fracOver32: o32 / n };
}

/** Carte de chaleur des différences : gris atténué de la référence, rouge d'autant plus vif que l'écart est grand (amplifié ×4). */
export function heatmap(a: Raster, b: Raster): Raster {
  const out = new Uint8Array(a.width * a.height * 4);
  for (let i = 0; i < a.width * a.height; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.data[i * 4 + c]! - b.data[i * 4 + c]!));
    const g = Math.round((0.299 * a.data[i * 4]! + 0.587 * a.data[i * 4 + 1]! + 0.114 * a.data[i * 4 + 2]!) * 0.35);
    const hot = Math.min(255, m * 4);
    out[i * 4] = Math.min(255, g + hot); out[i * 4 + 1] = Math.max(0, g - hot / 2); out[i * 4 + 2] = Math.max(0, g - hot / 2); out[i * 4 + 3] = 255;
  }
  return { width: a.width, height: a.height, data: out };
}

/** Luminance moyenne (0–255) sur une grille `cols × rows`, ligne par ligne. Les pixels sont composés sur le fond d'après leur alpha. */
export function lumaGrid(r: Raster, cols = 8, rows = 10): number[] {
  const sum = new Float64Array(cols * rows); const cnt = new Float64Array(cols * rows);
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    const i = (y * r.width + x) * 4; const k = Math.min(rows - 1, Math.floor((y / r.height) * rows)) * cols + Math.min(cols - 1, Math.floor((x / r.width) * cols));
    sum[k]! += 0.299 * r.data[i]! + 0.587 * r.data[i + 1]! + 0.114 * r.data[i + 2]!; cnt[k]!++;
  }
  return Array.from(sum, (s, k) => s / Math.max(1, cnt[k]!));
}

/** Distance entre deux signatures : RMS des écarts de luminance de case (niveaux de gris). */
export function gridDistance(a: readonly number[], b: readonly number[]): number {
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(s / a.length);
}
