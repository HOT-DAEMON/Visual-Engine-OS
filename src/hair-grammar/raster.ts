import type { V2 } from './vec';

/**
 * RASTÉRISEUR LOGICIEL MINIMAL pour l'ajustement par synthèse (autofit.ts). Il n'est pas le rendu final (celui-ci reste le SVG
 * rastérisé par resvg) : il reproduit seulement assez fidèlement l'ordre de peinture (couches, remplissages opaques, encre)
 * pour qu'une évaluation complète coûte ~1 ms au lieu de ~35 ms (SVG → resvg).
 */
export interface Buf { readonly w: number; readonly h: number; readonly ink: Uint8Array; readonly tone: Uint8Array; readonly id: Int16Array }

export const makeBuf = (w: number, h: number): Buf => ({ w, h, ink: new Uint8Array(w * h), tone: new Uint8Array(w * h).fill(255), id: new Int16Array(w * h) });
export const clearBuf = (b: Buf): void => { b.ink.fill(0); b.tone.fill(255); b.id.fill(0); };

/** Remplissage scanline (règle pair-impair) d'un polygone fermé ; écrit id/tone et efface l'encre dessous (peinture opaque). */
export function fillPoly(b: Buf, poly: readonly V2[], id: number, tone: number, s: number, inkVal = 0): void {
  const n = poly.length;
  let y0 = Infinity; let y1 = -Infinity;
  for (const p of poly) { if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const ya = Math.max(0, Math.floor(y0 * s)); const yb = Math.min(b.h - 1, Math.ceil(y1 * s));
  const xs: number[] = [];
  for (let y = ya; y <= yb; y++) {
    const yc = (y + 0.5) / s; xs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i] as V2; const c = poly[(i + 1) % n] as V2;
      if ((a.y <= yc && c.y > yc) || (c.y <= yc && a.y > yc)) xs.push((a.x + ((yc - a.y) / (c.y - a.y)) * (c.x - a.x)) * s);
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.round(xs[k] as number)); const xb = Math.min(b.w - 1, Math.round(xs[k + 1] as number) - 1);
      const row = y * b.w;
      for (let x = xa; x <= xb; x++) { b.id[row + x] = id; b.tone[row + x] = tone; b.ink[row + x] = inkVal; }
    }
  }
}

/** Trait d'encre de 1 pixel (Bresenham) entre deux points exprimés en unités image. */
export function inkLine(b: Buf, a: V2, c: V2, s: number): void {
  let x0 = Math.round(a.x * s); let y0 = Math.round(a.y * s); const x1 = Math.round(c.x * s); const y1 = Math.round(c.y * s);
  const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 >= 0 && y0 >= 0 && x0 < b.w && y0 < b.h) { const i = y0 * b.w + x0; b.ink[i] = 1; b.tone[i] = 17; }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function inkPath(b: Buf, pts: readonly V2[], s: number, close = false): void {
  for (let i = 0; i + 1 < pts.length; i++) inkLine(b, pts[i] as V2, pts[i + 1] as V2, s);
  if (close && pts.length > 2) inkLine(b, pts[pts.length - 1] as V2, pts[0] as V2, s);
}

/** Transformée en distance chamfer 3-4 (en pixels), `src` = 1 aux pixels d'encre. Tampon de sortie fourni (aucune allocation). */
export function distance(src: Uint8Array, w: number, h: number, out: Float32Array): void {
  const INF = 1e6; const a = 1; const d = 1.4142;
  for (let i = 0; i < out.length; i++) out[i] = src[i] ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = out[i] as number;
    if (x > 0) v = Math.min(v, (out[i - 1] as number) + a);
    if (y > 0) { v = Math.min(v, (out[i - w] as number) + a); if (x > 0) v = Math.min(v, (out[i - w - 1] as number) + d); if (x < w - 1) v = Math.min(v, (out[i - w + 1] as number) + d); }
    out[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = out[i] as number;
    if (x < w - 1) v = Math.min(v, (out[i + 1] as number) + a);
    if (y < h - 1) { v = Math.min(v, (out[i + w] as number) + a); if (x < w - 1) v = Math.min(v, (out[i + w + 1] as number) + d); if (x > 0) v = Math.min(v, (out[i + w - 1] as number) + d); }
    out[i] = v;
  }
}

/** Flou de boîte (rayon r) par image intégrée ; `out` en niveaux de gris flottants. */
export function boxBlur(src: Uint8Array, w: number, h: number, r: number, out: Float32Array, tmp: Float64Array): void {
  const W = w + 1;
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += src[y * w + x] as number; tmp[(y + 1) * W + x + 1] = (tmp[y * W + x + 1] as number) + row; } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r); const x1 = Math.min(w, x + r + 1); const y0 = Math.max(0, y - r); const y1 = Math.min(h, y + r + 1);
    const sum = (tmp[y1 * W + x1] as number) - (tmp[y0 * W + x1] as number) - (tmp[y1 * W + x0] as number) + (tmp[y0 * W + x0] as number);
    out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
  }
}
