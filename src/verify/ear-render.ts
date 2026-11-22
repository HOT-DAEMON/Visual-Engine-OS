import { inPoly, type Poly } from '../face/poly';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DU RENDU DE L'OREILLE : les contrôles de `verify/ear.ts` lisent la géométrie du modèle ; ceux-ci lisent les PIXELS réellement rendus
 * (une tête avec oreilles, la même sans). Un modèle correct peut produire une image fausse (oreille décollée de la joue, réduite à un trait, conque illisible) :
 * c'est cette image-là qui est jugée. Trois couches, comme le reste de la vérification :
 *   geometry — une seule forme connexe par oreille, attachée à la tête, dimensions rendues = dimensions du modèle ;
 *   anatomy  — la conque se lit comme un creux, la structure interne est lisible (pas de grande zone plate), les deux oreilles sont cohérentes ;
 *   style    — contraste de silhouette, harmonie avec la peau de la tête, palette cel réduite.
 * Pur : reçoit deux rasters RGBA (le rastériseur reste à l'appelant), aucune dépendance de rendu.
 */
export interface Raster { readonly w: number; readonly h: number; readonly px: ArrayLike<number> }
export interface EarBox { readonly side: -1 | 1; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }

const rgbSum = (r: Raster, i: number): number => (r.px[i] as number) + (r.px[i + 1] as number) + (r.px[i + 2] as number);
const luma = (r: Raster, x: number, y: number): number => { const i = (y * r.w + x) * 4; return (0.2126 * (r.px[i] as number) + 0.7152 * (r.px[i + 1] as number) + 0.0722 * (r.px[i + 2] as number)) / 255; };

/** Masque des pixels que l'oreille change (somme RGB > `thr`) dans la boîte, sous forme de grille booléenne locale. */
export function earMask(withEars: Raster, without: Raster, b: EarBox, thr = 24): { mask: Uint8Array; w: number; h: number; x0: number; y0: number } {
  const x0 = Math.max(0, Math.floor(b.x0)), y0 = Math.max(0, Math.floor(b.y0)), x1 = Math.min(withEars.w - 1, Math.ceil(b.x1)), y1 = Math.min(withEars.h - 1, Math.ceil(b.y1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1, mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y + y0) * withEars.w + (x + x0)) * 4; if (Math.abs(rgbSum(withEars, i) - rgbSum(without, i)) > thr) mask[y * w + x] = 1; }
  return { mask, w, h, x0, y0 };
}

/** Composantes connexes (4-voisinage) : aires triées décroissantes ; `keep` = indices de la plus grande. */
export function components(mask: Uint8Array, w: number, h: number): { areas: number[]; label: Int32Array } {
  const label = new Int32Array(w * h).fill(-1), areas: number[] = [], stack: number[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s] !== -1) continue;
    const id = areas.length; let a = 0; stack.push(s); label[s] = id;
    while (stack.length) {
      const q = stack.pop() as number; a++;
      const x = q % w, y = (q - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (mask[n] && label[n] === -1) { label[n] = id; stack.push(n); }
      }
    }
    areas.push(a);
  }
  return { areas, label };
}

/**
 * Part des lignes où l'oreille est DÉCOLLÉE de la tête : à partir du pixel d'oreille le plus proche de la tête, on compte les pixels de FOND (tête sans oreille) qui
 * les séparent de la tête. La tolérance suit l'anatomie : serrée sur les trois quarts supérieurs (l'hélix et la conque tiennent à l'os temporal), plus large sur le
 * dernier quart (la pointe du lobule pend librement). `hPx` = hauteur rendue de l'oreille.
 */
export function detachedShare(without: Raster, m: ReturnType<typeof earMask>, side: -1 | 1, hPx: number, bg = 765): number {
  const rowsWith: number[] = [];
  for (let y = 0; y < m.h; y++) for (let k = 0; k < m.w; k++) { const x = side > 0 ? k : m.w - 1 - k; if (m.mask[y * m.w + x]) { rowsWith.push(y); break; } }
  if (!rowsWith.length) return 0;
  const top = rowsWith[0] as number, span = Math.max(1, (rowsWith[rowsWith.length - 1] as number) - top);
  let bad = 0;
  for (const y of rowsWith) {
    let inner = 0;
    for (let k = 0; k < m.w; k++) { const x = side > 0 ? k : m.w - 1 - k; if (m.mask[y * m.w + x]) { inner = x + m.x0; break; } }
    let gap = 0;
    const step = -side;
    while (gap < 200) { const x = inner + step * (gap + 1); if (x < 0 || x >= without.w || Math.abs(rgbSum(without, ((y + m.y0) * without.w + x) * 4) - bg) > 45) break; gap++; }
    const t = (y - top) / span, free = Math.min(1, Math.max(0, (t - 0.7) / 0.3));
    if (gap > hPx * (0.05 + 0.25 * free)) bad++;
  }
  return bad / rowsWith.length;
}

export interface EarRenderInput {
  readonly withEars: Raster;
  readonly without: Raster;
  readonly boxes: readonly EarBox[];
  /** Abscisse (px) de l'axe de la tête. */
  readonly headCx: number;
  /** Hauteurs et largeurs attendues par le MODÈLE, en px (rapport rendu/modèle). */
  readonly expected: readonly { side: -1 | 1; widthPx: number; heightPx: number }[];
  readonly exaggeration: number;
  readonly look: 'realistic' | 'anime';
}

/** Contrôles de rendu sur une tête entière (de face). Les identifiants sont préfixés `ear-render-`. */
export function earRenderChecks(inp: EarRenderInput): Check[] {
  const o: Check[] = [];
  const ratios: number[] = [];
  const heights: number[] = [];
  for (const b of inp.boxes) {
    const s = b.side < 0 ? 'L' : 'R';
    const m = earMask(inp.withEars, inp.without, b);
    const { areas, label } = components(m.mask, m.w, m.h);
    if (!areas.length) { o.push(check('geometry', `ear-render-present-${s}`, '>=', 0, 1, `l'oreille ${s} ne change aucun pixel : elle n'est pas rendue`)); continue; }
    const big = Math.max(...areas), main = areas.indexOf(big);
    // GÉOMÉTRIE — une seule forme : tout fragment ≥ 4 % de la plus grande est un morceau flottant.
    const frag = areas.filter((a, i) => i !== main && a >= 0.04 * big).length;
    o.push(check('geometry', `ear-render-connected-${s}`, '<=', frag, 0, `l'oreille ${s} est rendue en plusieurs morceaux (${frag} fragment(s) flottant(s))`));
    let x0 = m.w, x1 = -1, y0 = m.h, y1 = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (label[y * m.w + x] === main) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const wPx = x1 - x0 + 1, hPx = y1 - y0 + 1;
    ratios.push(wPx / hPx); heights.push(hPx);
    // GÉOMÉTRIE — l'oreille tient à la tête : part de lignes décollées.
    const main1 = { ...m, mask: Uint8Array.from(m.mask, (v, i) => (v && label[i] === main ? 1 : 0)) };
    const det = detachedShare(inp.without, main1, b.side, hPx);
    o.push(check('geometry', `ear-render-attached-${s}`, '<=', det, 0.15, `l'oreille ${s} est décollée de la tête sur ${(det * 100).toFixed(0)} % de sa hauteur (jupe de racine absente ou trop courte)`));
    // GÉOMÉTRIE — dimensions rendues = dimensions du modèle (l'image dit la même chose que la géométrie), l'occlusion par la joue en retire une part.
    const exp = inp.expected.find((e) => e.side === b.side);
    if (exp) {
      o.push(check('geometry', `ear-render-height-${s}`, '<=', Math.abs(hPx - exp.heightPx) / exp.heightPx, 0.2, `la hauteur rendue de l'oreille ${s} s'écarte du modèle`));
    }
    // ANATOMIE — l'oreille ne se réduit pas à un trait (largeur/hauteur rendues).
    o.push(check('anatomy', `ear-render-not-a-stroke-${s}`, '>=', wPx / hPx, 0.17 * (1 - 0.6 * inp.exaggeration), `l'oreille ${s} est rendue comme un trait (largeur/hauteur ${(wPx / hPx).toFixed(2)})`));
    // ANATOMIE — la structure interne se lit : part de pixels de l'oreille dont le voisinage (5 × 5) a un écart de luminance non nul.
    let tex = 0, tot = 0;
    for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
      if (label[y * m.w + x] !== main) continue;
      tot++;
      let mn = 1, mx = 0;
      for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) { const l = luma(inp.withEars, x + m.x0 + dx, y + m.y0 + dy); if (l < mn) mn = l; if (l > mx) mx = l; }
      if (mx - mn > 0.02) tex++;
    }
    o.push(check('anatomy', `ear-render-structure-readable-${s}`, '>=', tot ? tex / tot : 0, 0.1, `la structure interne de l'oreille ${s} est illisible à cette échelle (zone presque plate)`, 'warn'));
    // STYLE — contraste de silhouette : la moyenne de luminance de l'oreille diffère de celle de l'arrière-plan blanc.
    let sum = 0, n = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (label[y * m.w + x] === main) { sum += luma(inp.withEars, x + m.x0, y + m.y0); n++; }
    o.push(check('style', `ear-render-silhouette-contrast-${s}`, '>=', 1 - sum / Math.max(1, n), 0.12, `l'oreille ${s} se détache mal du fond (luminance moyenne trop claire)`, 'warn'));
    // STYLE — palette cel : en look anime, peu de tons perçus dans l'oreille (16 niveaux par canal).
    if (inp.look === 'anime') {
      const tones = new Set<number>();
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (label[y * m.w + x] === main) { const i = ((y + m.y0) * inp.withEars.w + x + m.x0) * 4; tones.add(((inp.withEars.px[i] as number) >> 4) * 256 + ((inp.withEars.px[i + 1] as number) >> 4) * 16 + ((inp.withEars.px[i + 2] as number) >> 4)); }
      o.push(check('style', `ear-render-cel-palette-${s}`, '<=', tones.size, 60, `le rendu cel de l'oreille ${s} a trop de tons (${tones.size})`, 'warn'));
    }
  }
  // ANATOMIE — cohérence bilatérale rendue : les deux hauteurs rendues restent proches (l'asymétrie est bornée par le style, pas libre).
  if (heights.length === 2) o.push(check('anatomy', 'ear-render-bilateral-height', '<=', Math.abs((heights[0] as number) - (heights[1] as number)) / Math.max(...heights), 0.3, 'les deux oreilles rendues ont des hauteurs trop différentes'));
  if (ratios.length === 2) o.push(check('anatomy', 'ear-render-bilateral-width', '<=', Math.abs((ratios[0] as number) - (ratios[1] as number)) / Math.max(...ratios), 0.6, 'les deux oreilles rendues ont des largeurs trop différentes'));
  return o;
}

/**
 * Lisibilité de la CONQUE dans une vue d'oreille rendue (gros plan ou trois-quarts) : contraste de luminance entre le fond du cavum (quantile 25 % du polygone projeté)
 * et la médiane de l'intérieur du pavillon. Un creux se lit s'il est nettement plus sombre ; la part de l'aire de la conque dans le pavillon est mesurée sur la géométrie projetée.
 */
export function conchaReadability(img: Raster, rim: Poly, cavum: Poly, minContrast = 0.08): { contrast: number; share: number; checks: Check[] } {
  const area = (p: Poly): number => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length] as { x: number; y: number }; return s + q.x * r.y - r.x * q.y; }, 0)) / 2;
  const xs = rim.map((q) => q.x), ys = rim.map((q) => q.y);
  const bx0 = Math.max(0, Math.floor(Math.min(...xs))), bx1 = Math.min(img.w - 1, Math.ceil(Math.max(...xs))), by0 = Math.max(0, Math.floor(Math.min(...ys))), by1 = Math.min(img.h - 1, Math.ceil(Math.max(...ys)));
  const vals: number[] = [];
  for (let y = by0; y <= by1; y += 2) for (let x = bx0; x <= bx1; x += 2) if (inPoly(rim, x, y)) vals.push(luma(img, x, y));
  vals.sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)] ?? 1;
  // Luminance du fond de la conque : quantile 25 % sur tout l'intérieur du cavum (robuste à un bijou ou à un pore au centre, qu'un échantillon ponctuel lirait comme « clair »).
  const cx = cavum.map((q) => q.x), cy = cavum.map((q) => q.y), cv: number[] = [];
  for (let y = Math.max(0, Math.floor(Math.min(...cy))); y <= Math.min(img.h - 1, Math.ceil(Math.max(...cy))); y++) for (let x = Math.max(0, Math.floor(Math.min(...cx))); x <= Math.min(img.w - 1, Math.ceil(Math.max(...cx))); x++) if (inPoly(cavum, x, y)) cv.push(luma(img, x, y));
  cv.sort((a, b) => a - b);
  const low = cv[Math.floor(cv.length * 0.25)] ?? med;
  const contrast = (med - low) / Math.max(0.05, med);
  const share = area(cavum) / Math.max(1e-9, area(rim));
  return {
    contrast, share,
    checks: [
      check('anatomy', 'ear-render-concha-contrast', '>=', contrast, minContrast, 'le fond de la conque ne se lit pas comme un creux (pas plus sombre que le reste du pavillon)'),
      check('anatomy', 'ear-render-concha-share', '>=', share, 0.1, 'la conque est trop petite par rapport au pavillon (la région hélix → lobule domine)'),
    ],
  };
}
