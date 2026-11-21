import { signedAxis, type HeadEllipse, type Reference } from './observe';
import { clamp } from './vec';

/**
 * OBSERVATION STRUCTURÉE d'une référence — au-delà des sept grandeurs globales de `observe.ts`, ce qu'un masque et une luminance permettent VRAIMENT d'extraire
 * sans segmentation par mèche (qu'un raster n'offre pas : les mèches se touchent) :
 *  - RÉGIONS DE FLUX : le masque des cheveux est partitionné (k-means déterministe) selon la POSITION et l'ORIENTATION locale du gradient (tenseur de structure,
 *    orientation doublée pour être définie modulo π). Chaque région = une masse de brins qui vont dans le même sens, au même endroit :
 *    part de surface (hiérarchie des masses dominantes), centre, axe de lecture signé, cohérence, ton moyen ;
 *  - ASYMÉTRIE : moment gauche/droite des régions, part de l'aire de la plus grande région du côté dominant ;
 *  - FRANGE : part du masque dans la bande du front de l'ellipse de tête ;
 *  - RAIE : colonne la plus vide de la calotte (|u| < 0,7), position et netteté (profondeur du creux relative à la couverture médiane) ;
 *  - REFLETS : part de pixels clairs (> 0,92) à l'intérieur du masque, et leur étalement (nombre de composantes).
 * NON OBSERVABLE ici (et documenté dans HAIR-PASS3-REMAINING) : le NOMBRE de mèches, les pointes (aiguës / franches), la hiérarchie par famille de la grammaire.
 */
export interface FlowRegion { readonly share: number; readonly cx: number; readonly cy: number; readonly axis: number; readonly coherence: number; readonly tone: number; readonly rank: number }
export interface ArtStructure {
  readonly regions: FlowRegion[];
  readonly hierarchy: { readonly dominantShare: number; readonly ratio: number };
  /** Moment gauche/droite des régions, en demi-largeurs de tête (−1…1). */
  readonly asymmetry: number;
  /** Part du masque dans la bande du front. */
  readonly fringe: number;
  readonly part: { readonly u: number; readonly clarity: number };
  readonly gloss: { readonly share: number; readonly spots: number };
}

const K = 5; const STRIDE = 2; const WIN = 3;

/** Orientation locale doublée (cos 2θ, sin 2θ) et cohérence du tenseur de structure, fenêtre (2·WIN+1)², pour chaque pixel du masque. */
function orientation(R: Reference): { c: Float32Array; s: Float32Array } {
  const n = R.w * R.h; const gx = new Float32Array(n); const gy = new Float32Array(n);
  for (let y = 1; y < R.h - 1; y++) for (let x = 1; x < R.w - 1; x++) { const i = y * R.w + x; gx[i] = (R.gray[i + 1] as number) - (R.gray[i - 1] as number); gy[i] = (R.gray[i + R.w] as number) - (R.gray[i - R.w] as number); }
  const c = new Float32Array(n); const s = new Float32Array(n);
  for (let y = WIN; y < R.h - WIN; y += STRIDE) for (let x = WIN; x < R.w - WIN; x += STRIDE) {
    const i = y * R.w + x; if (!R.mask[i]) continue;
    let jxx = 0; let jyy = 0; let jxy = 0;
    for (let dy = -WIN; dy <= WIN; dy++) for (let dx = -WIN; dx <= WIN; dx++) { const k = i + dy * R.w + dx; if (!R.mask[k]) continue; const a = gx[k] as number; const b = gy[k] as number; jxx += a * a; jyy += b * b; jxy += a * b; }
    const tr = jxx + jyy; if (tr < 1e-6) continue;
    // Axe des brins = perpendiculaire au gradient : orientation doublée du gradient, retournée (cos(2θ+π) = −cos 2θ).
    c[i] = -(jxx - jyy) / tr; s[i] = -(2 * jxy) / tr;
  }
  return { c, s };
}

export function observeStructure(R: Reference, H: HeadEllipse): ArtStructure {
  const { c, s } = orientation(R);
  type P = { x: number; y: number; c: number; s: number; g: number }; const pts: P[] = [];
  for (let y = WIN; y < R.h - WIN; y += STRIDE) for (let x = WIN; x < R.w - WIN; x += STRIDE) { const i = y * R.w + x; if (R.mask[i]) pts.push({ x: (x - H.cx) / H.rx, y: (y - H.cy) / H.ry, c: c[i] as number, s: s[i] as number, g: R.gray[i] as number }); }
  if (pts.length < K * 4) return { regions: [], hierarchy: { dominantShare: 0, ratio: 0 }, asymmetry: 0, fringe: 0, part: { u: 0, clarity: 0 }, gloss: { share: 0, spots: 0 } };
  // k-means déterministe : initialisation par point le plus éloigné, 12 itérations. Distance = position (poids 1) + orientation doublée (poids 1,2).
  const f = (p: P): number[] => [p.x, p.y, 1.2 * p.c, 1.2 * p.s];
  const F = pts.map(f); const cen: number[][] = [F[0] as number[]];
  while (cen.length < K) { let bi = 0; let bd = -1; F.forEach((v, i) => { const d = Math.min(...cen.map((q) => v.reduce((a, b, j) => a + (b - (q[j] as number)) ** 2, 0))); if (d > bd) { bd = d; bi = i; } }); cen.push(F[bi] as number[]); }
  const lab = new Int32Array(F.length);
  for (let it = 0; it < 12; it++) {
    F.forEach((v, i) => { let b = 0; let bd = Infinity; cen.forEach((q, k) => { const d = v.reduce((a, x, j) => a + (x - (q[j] as number)) ** 2, 0); if (d < bd) { bd = d; b = k; } }); lab[i] = b; });
    cen.forEach((_, k) => { const m = F.filter((__, i) => lab[i] === k); if (m.length) cen[k] = [0, 1, 2, 3].map((j) => m.reduce((a, v) => a + (v[j] as number), 0) / m.length); });
  }
  const regions: FlowRegion[] = cen.map((_, k) => {
    const m = pts.filter((__, i) => lab[i] === k); const n = Math.max(1, m.length); const mc = m.reduce((a, p) => a + p.c, 0) / n; const ms = m.reduce((a, p) => a + p.s, 0) / n;
    return { share: m.length / pts.length, cx: m.reduce((a, p) => a + p.x, 0) / n, cy: m.reduce((a, p) => a + p.y, 0) / n, axis: signedAxis(0.5 * Math.atan2(ms, mc)), coherence: Math.hypot(mc, ms), tone: m.reduce((a, p) => a + p.g, 0) / n, rank: 0 };
  }).filter((r) => r.share > 0).sort((a, b) => b.share - a.share).map((r, rank) => ({ ...r, rank }));
  const hierarchy = { dominantShare: regions[0]?.share ?? 0, ratio: (regions[0]?.share ?? 0) / Math.max(1e-9, regions[1]?.share ?? 1e-9) };
  const asymmetry = clamp(regions.reduce((a, r) => a + r.share * r.cx, 0), -1, 1);
  // Frange : bande du front (au-dessus du centre, |u| < 0,6), part du masque.
  let fr = 0; let frN = 0; const col = new Float64Array(R.w).fill(0); const colN = new Float64Array(R.w).fill(0);
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
    const u = (x - H.cx) / H.rx; const v = (y - H.cy) / H.ry; const m = R.mask[y * R.w + x] as number;
    if (v >= -0.65 && v <= -0.2 && Math.abs(u) < 0.6) { frN++; fr += m; }
    if (v >= -0.85 && v <= -0.5 && Math.abs(u) < 0.55) { col[x] = (col[x] as number) + m; colN[x] = (colN[x] as number) + 1; }
  }
  // Raie : colonne la moins couverte de la calotte (moyenne mobile de 3 colonnes) rapportée à la couverture médiane.
  const cov: { x: number; v: number }[] = []; for (let x = 2; x < R.w - 2; x++) if ((colN[x] as number) > 0) cov.push({ x, v: ((col[x - 1] as number) + (col[x] as number) + (col[x + 1] as number)) / Math.max(1, (colN[x - 1] as number) + (colN[x] as number) + (colN[x + 1] as number)) });
  const sorted = [...cov].sort((a, b) => a.v - b.v); const covMed = sorted[Math.floor(sorted.length / 2)]?.v ?? 0; const low = sorted[0];
  const part = low ? { u: (low.x - H.cx) / H.rx, clarity: covMed > 0.05 ? clamp(1 - low.v / covMed, 0, 1) : 0 } : { u: 0, clarity: 0 };
  // Reflets : pixels clairs du masque, composantes 4-connexes.
  // « Clair » est RELATIF au corps des cheveux : au-dessus de la médiane + 0,25 (une photo claire n'est pas un reflet partout), jamais au-dessus de 0,98.
  const inMask: number[] = []; for (let i = 0; i < R.w * R.h; i++) if (R.mask[i]) inMask.push(R.gray[i] as number);
  const med = [...inMask].sort((a, b) => a - b)[Math.floor(inMask.length / 2)] ?? 1; const hi = Math.min(0.98, med + 0.25);
  let bright = 0; const tot = inMask.length; const seen = new Uint8Array(R.w * R.h); let spots = 0;
  for (const g of inMask) if (g > hi) bright++;
  for (let i = 0; i < R.w * R.h; i++) {
    if (seen[i] || !R.mask[i] || (R.gray[i] as number) <= hi) continue; spots++; const st = [i]; seen[i] = 1;
    while (st.length) { const j = st.pop() as number; const x = j % R.w; for (const k of [x > 0 ? j - 1 : -1, x < R.w - 1 ? j + 1 : -1, j - R.w, j + R.w]) if (k >= 0 && k < R.w * R.h && !seen[k] && R.mask[k] && (R.gray[k] as number) > hi) { seen[k] = 1; st.push(k); } }
  }
  return { regions, hierarchy, asymmetry, fringe: frN ? fr / frN : 0, part, gloss: { share: tot ? bright / tot : 0, spots } };
}
