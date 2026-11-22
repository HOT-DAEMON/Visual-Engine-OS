import type { HeadEllipse, Reference } from './observe';
import { clamp } from './vec';

/**
 * SEGMENTATION PAR MÈCHE d'une référence raster — ce que `observe-structure.ts` déclarait impossible (« les mèches se touchent »). Elle l'est SI on cherche des frontières
 * de mèches là où l'image en contient réellement : une VALLÈE de luminance perpendiculaire au flux (le trait d'encre, l'ombre portée entre deux mèches) — pas là où les
 * masses sont simplement voisines. Méthode (déterministe, sans apprentissage) :
 *  1. orientation locale des brins : tenseur de structure à fenêtre carrée (rayon `WIN`) restreint au masque, axe = perpendiculaire du gradient (mod π) ;
 *  2. vallée : on lisse la luminance LE LONG du flux (5 échantillons : le bruit transversal d'un trait disparaît, le trait lui-même reste), puis on compare un pixel à la moyenne de
 *     ses deux voisins à ±`REACH` pixels en TRAVERS du flux : v = moy(voisins) − pixel. Pixel de vallée si v > `VALLEY` ;
 *  3. mèches = composantes 4-connexes du masque privé des vallées, d'aire ≥ `MIN_AREA` (fraction de l'aire de la tête) ; chacune est décrite par ses moments d'ordre 2
 *     (rectangle équivalent : longueur = √(12 λ₁), largeur = aire / longueur), son axe (mod π), son ton moyen.
 * LIMITES (mesurées, voir `docs/HAIR-PASS4.md`) : une mèche coupée en deux par une autre qui la recouvre donne DEUX composantes (sur-segmentation) ; deux mèches séparées par
 * aucune vallée (même ton, sans contour) n'en donnent qu'UNE (sous-segmentation). Le NOMBRE de composantes n'est donc PAS le nombre de `LockSpec` : on rapporte le ratio mesuré.
 */
export interface StrandObs { readonly cx: number; readonly cy: number; readonly length: number; readonly width: number; readonly axis: number; readonly tone: number; readonly area: number }
export interface StrandSegmentation {
  readonly strands: StrandObs[];
  /** Étiquette par pixel : indice dans `strands`, ou −1 (hors masque, vallée, ou composante trop petite). */
  readonly labels: Int32Array;
  readonly count: number;
  /** Largeur (unités de demi-largeur de tête, rx) : moyenne et coefficient de variation. */
  readonly width: { readonly mean: number; readonly cv: number };
  readonly length: { readonly mean: number; readonly cv: number };
  /** Part du masque occupée par les mèches retenues. */
  readonly coverage: number;
}

const WIN = 3; const REACH = 2; const VALLEY = 0.07; const MIN_AREA = 0.0035; const CORE = 1; const GROW_VALLEY = 2;

/** Axe local (rad, mod π) des brins, par pixel du masque ; NaN hors masque ou sans gradient. */
function axisField(R: Reference): Float32Array {
  const n = R.w * R.h; const gx = new Float32Array(n); const gy = new Float32Array(n); const ax = new Float32Array(n).fill(NaN);
  for (let y = 1; y < R.h - 1; y++) for (let x = 1; x < R.w - 1; x++) { const i = y * R.w + x; gx[i] = (R.gray[i + 1] as number) - (R.gray[i - 1] as number); gy[i] = (R.gray[i + R.w] as number) - (R.gray[i - R.w] as number); }
  for (let y = WIN; y < R.h - WIN; y++) for (let x = WIN; x < R.w - WIN; x++) {
    const i = y * R.w + x; if (!R.mask[i]) continue; let jxx = 0; let jyy = 0; let jxy = 0;
    for (let dy = -WIN; dy <= WIN; dy++) for (let dx = -WIN; dx <= WIN; dx++) { const k = i + dy * R.w + dx; if (!R.mask[k]) continue; const a = gx[k] as number; const b = gy[k] as number; jxx += a * a; jyy += b * b; jxy += a * b; }
    if (jxx + jyy < 1e-6) continue; ax[i] = 0.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2;
  }
  return ax;
}

const at = (R: Reference, x: number, y: number): number => (R.gray[clamp(Math.round(y), 0, R.h - 1) * R.w + clamp(Math.round(x), 0, R.w - 1)] as number);

export function segmentStrands(R: Reference, H: HeadEllipse): StrandSegmentation {
  const n = R.w * R.h; const ax = axisField(R); const valley = new Uint8Array(n);
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
    const i = y * R.w + x; const a = ax[i] as number; if (!R.mask[i] || Number.isNaN(a)) continue;
    const tx = Math.cos(a); const ty = Math.sin(a); const nx = -ty; const ny = tx;
    const along = (px: number, py: number): number => { let s = 0; for (let k = -2; k <= 2; k++) s += at(R, px + k * tx, py + k * ty); return s / 5; };
    const side = 0.5 * (along(x + REACH * nx, y + REACH * ny) + along(x - REACH * nx, y - REACH * ny));
    if (side - along(x, y) > VALLEY) valley[i] = 1;
  }
  // Marqueurs : le NOYAU des pixels de mèche (érodé de `CORE` pixels) coupe les ponts minces (1–2 px) qu'une vallée interrompue laisse entre deux mèches ; on étiquette les noyaux
  // (4-connexité) puis on les fait regrossir dans les pixels de mèche (BFS multi-sources, sans franchir une vallée) : chaque pixel va au noyau le plus proche.
  const strandPx = (i: number): boolean => R.mask[i] === 1 && !valley[i];
  const isCore = new Uint8Array(n);
  for (let y = CORE; y < R.h - CORE; y++) for (let x = CORE; x < R.w - CORE; x++) { const i = y * R.w + x; if (!strandPx(i)) continue; let ok = true; for (let d = 1; d <= CORE && ok; d++) ok = strandPx(i - d) && strandPx(i + d) && strandPx(i - d * R.w) && strandPx(i + d * R.w); if (ok) isCore[i] = 1; }
  const labels = new Int32Array(n).fill(-1); const comp = new Int32Array(n).fill(-1); const strands: StrandObs[] = [];
  const minArea = Math.max(6, MIN_AREA * Math.PI * H.rx * H.ry); let maskN = 0; for (let i = 0; i < n; i++) if (R.mask[i]) maskN++;
  let c = 0; const q: number[] = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (!isCore[s0] || (comp[s0] as number) >= 0) continue;
    const st = [s0]; comp[s0] = c;
    while (st.length) {
      const i = st.pop() as number; q.push(i); const x = i % R.w; const y = (i / R.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const xx = x + dx; const yy = y + dy; if (xx < 0 || yy < 0 || xx >= R.w || yy >= R.h) continue; const j = yy * R.w + xx; if (isCore[j] && (comp[j] as number) < 0) { comp[j] = c; st.push(j); } }
    }
    c++;
  }
  // Croissance : file FIFO initialisée avec tous les pixels de noyau (l'ordre des sources fixe l'arbitrage, déterministe).
  for (let h = 0; h < q.length; h++) {
    const i = q[h] as number; const x = i % R.w; const y = (i / R.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const xx = x + dx; const yy = y + dy; if (xx < 0 || yy < 0 || xx >= R.w || yy >= R.h) continue; const j = yy * R.w + xx; if (strandPx(j) && (comp[j] as number) < 0) { comp[j] = comp[i] as number; q.push(j); } }
  }
  const pre = new Array<number>(c).fill(0); for (let i = 0; i < n; i++) if ((comp[i] as number) >= 0) pre[comp[i] as number]!++; // aire SANS les traits : un éclat de trait ne devient pas une mèche en grossissant
  // Les traits de vallée (1–2 px d'encre) appartiennent à la mèche qu'ils bordent : sans eux, la largeur serait sous-estimée de l'épaisseur du trait. Deux tours de dilatation, dans le masque.
  for (let r = 0; r < GROW_VALLEY; r++) {
    const prev = Int32Array.from(comp);
    for (let i = 0; i < n; i++) {
      if (!R.mask[i] || prev[i]! >= 0) continue; const x = i % R.w; const y = (i / R.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const xx = x + dx; const yy = y + dy; if (xx < 0 || yy < 0 || xx >= R.w || yy >= R.h) continue; const l = prev[yy * R.w + xx]!; if (l >= 0) { comp[i] = l; break; } }
    }
  }
  const members: number[][] = Array.from({ length: c }, () => []); for (let i = 0; i < n; i++) if ((comp[i] as number) >= 0) members[comp[i] as number]?.push(i);
  const kept = members.filter((_px, k) => (pre[k] as number) >= minArea);
  for (const px of kept) {
    let mx = 0; let my = 0; let g = 0; for (const i of px) { mx += i % R.w; my += (i / R.w) | 0; g += R.gray[i] as number; } mx /= px.length; my /= px.length;
    let sxx = 0; let syy = 0; let sxy = 0; for (const i of px) { const dx = (i % R.w) - mx; const dy = ((i / R.w) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; } sxx /= px.length; syy /= px.length; sxy /= px.length;
    const tr = sxx + syy; const det = Math.hypot((sxx - syy) / 2, sxy); const l1 = tr / 2 + det; const length = Math.sqrt(12 * Math.max(l1, 1e-9));
    const k = strands.length; for (const i of px) labels[i] = k;
    strands.push({ cx: (mx - H.cx) / H.rx, cy: (my - H.cy) / H.ry, length: length / H.rx, width: px.length / length / H.rx, axis: 0.5 * Math.atan2(2 * sxy, sxx - syy), tone: g / px.length, area: px.length / (Math.PI * H.rx * H.ry) });
  }
  const stat = (v: number[]): { mean: number; cv: number } => { const m = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); return { mean: m, cv: m > 0 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length)) / m : 0 }; };
  const covered = kept.reduce((a, p) => a + p.length, 0);
  return { strands, labels, count: strands.length, width: stat(strands.map((s) => s.width)), length: stat(strands.map((s) => s.length)), coverage: maskN ? covered / maskN : 0 };
}
