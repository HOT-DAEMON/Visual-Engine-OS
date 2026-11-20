import { close, makeGrid, type Grid } from './compose-grid';
import type { CompositionSpec } from './compose-plan';
import type { Intent } from './intent';
import { clamp } from './vec';

/**
 * OBSERVATION D'UNE RÉFÉRENCE — la direction artistique part d'une image, pas d'un mot. On n'invente rien : on MESURE sur une référence
 * (masque des cheveux + luminance + ellipse de la tête en repère image) les seules grandeurs qu'un masque et un niveau de gris
 * déterminent vraiment, puis on les convertit en `CompositionSpec` / `Intent`.
 * OBSERVABLE : largeur et hauteur du volume, équilibre G/D, axe d'écoulement (tenseur de structure du gradient de luminance : l'axe des
 * brins est PERPENDICULAIRE au gradient, défini modulo π), cohérence de cet axe, part d'espaces négatifs de l'enveloppe fermée.
 * NON OBSERVABLE sans segmentation par mèche (restant à faire, docs/HAIR-INTENT.md) : hiérarchie des familles, nombre de mèches, sens
 * racine → pointe (levé par `down` : on choisit le sens qui descend ; pour un balayage horizontal on passe `towards`).
 */
export interface Reference { readonly w: number; readonly h: number; readonly mask: Uint8Array; readonly gray: Float32Array }
export interface HeadEllipse { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }
export interface ArtObservations { readonly widthRatio: number; readonly heightRatio: number; readonly moment: number; readonly axis: number; readonly coherence: number; readonly negative: number; readonly coverage: number }

/** Référence à partir de pixels RGBA : masque = alpha > 0,5 ; luminance Rec. 709. */
export function referenceFromRGBA(w: number, h: number, rgba: Uint8Array | Uint8ClampedArray | Buffer): Reference {
  const mask = new Uint8Array(w * h); const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const r = rgba[4 * i] as number; const g = rgba[4 * i + 1] as number; const b = rgba[4 * i + 2] as number; mask[i] = (rgba[4 * i + 3] as number) > 127 ? 1 : 0; gray[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
  return { w, h, mask, gray };
}

export function observe(R: Reference, H: HeadEllipse): ArtObservations {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let n = 0; let sx = 0;
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) if (R.mask[y * R.w + x]) { n++; sx += x; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  if (!n) return { widthRatio: 0, heightRatio: 0, moment: 0, axis: 0, coherence: 0, negative: 0, coverage: 0 };
  // Tenseur de structure sur l'intérieur du masque (bords du masque exclus : leur gradient est celui de la silhouette, pas des brins).
  let jxx = 0; let jyy = 0; let jxy = 0; const inside = (x: number, y: number): boolean => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx; const yy = y + dy; if (xx < 0 || yy < 0 || xx >= R.w || yy >= R.h || !R.mask[yy * R.w + xx]) return false; } return true; };
  for (let y = 1; y < R.h - 1; y++) for (let x = 1; x < R.w - 1; x++) {
    if (!inside(x, y)) continue; const i = y * R.w + x;
    const gx = (R.gray[i + 1] as number) - (R.gray[i - 1] as number); const gy = (R.gray[i + R.w] as number) - (R.gray[i - R.w] as number);
    jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
  }
  const tr = jxx + jyy; const det = Math.hypot((jxx - jyy) / 2, jxy);
  const grad = 0.5 * Math.atan2(2 * jxy, jxx - jyy); const axis = grad + Math.PI / 2;
  const coherence = tr > 1e-9 ? (2 * det) / tr : 0;
  const g: Grid = makeGrid(R.w, R.h, 3); for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) g.data[y * g.nx + x] = R.mask[Math.min(R.h - 1, y * 3 + 1) * R.w + Math.min(R.w - 1, x * 3 + 1)] as number;
  const env = close(g, 3); let envN = 0; let cov = 0; for (let i = 0; i < g.data.length; i++) { if (env.data[i]) envN++; if (g.data[i]) cov++; }
  return { widthRatio: (x1 - x0) / (2 * H.rx), heightRatio: (H.cy - H.ry - y0) / (2 * H.ry), moment: (sx / n - H.cx) / H.rx, axis, coherence, negative: envN ? (envN - cov) / envN : 0, coverage: n / (R.w * R.h) };
}

/** Axe (mod π) → angle signé : le sens qui descend (y > 0) ; si l'axe est quasi horizontal, le sens vers `towards` (rad). */
export function signedAxis(axis: number, towards = Math.PI / 2): number {
  const a = Math.atan2(Math.sin(axis), Math.cos(axis)); const b = a + Math.PI; const pick = (t: number): number => (Math.cos(a - t) >= Math.cos(b - t) ? a : b);
  const w = (v: number): number => Math.atan2(Math.sin(v), Math.cos(v));
  return Math.abs(Math.sin(a)) > 0.35 ? (Math.sin(a) > 0 ? a : w(b)) : w(pick(towards));
}

/**
 * Observations → réglages. Étalonnage MESURÉ sur la grammaire (TOUSLED, 3 graines, sondes de `tests/hair-engine-intent.test.ts`) :
 * largeur du volume 1,19 → 1,87 pour volume −1 → +1 ; part couverte de l'enveloppe 0,81 → 0,89 pour weight −1 → +1.
 */
export function observationsToSpec(o: ArtObservations, towards = Math.PI / 2): { composition: CompositionSpec; intent: Intent } {
  return {
    composition: { reading: signedAxis(o.axis, towards), balance: clamp(o.moment, -0.5, 0.5) },
    intent: { volume: clamp((o.widthRatio - 1.51) / 0.34, -1, 1), weight: clamp((1 - o.negative - 0.856) / 0.04, -1, 1) },
  };
}
