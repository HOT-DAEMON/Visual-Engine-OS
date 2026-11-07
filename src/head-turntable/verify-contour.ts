import { REGION, type TurnRender } from './types';
import { PART } from './mesh';

/**
 * AUDIT PIXEL DU CONTOUR DE LA TÊTE (mâchoire, menton, joues). Travaille sur l'IMAGE rendue (`ids`, `regions`, `rgba`), pas sur la géométrie :
 * c'est ce que l'œil voit. Le contour du masque « tête » (crâne + bosses) est tracé pixel par pixel (voisinage de Moore), rééchantillonné à pas
 * constant en U, puis mesuré : rayon de courbure minimal (angle vif), inflexions (la ligne « pend » : creux entre la joue et une poche), défaut de
 * convexité (profondeur du creux par rapport à l'enveloppe convexe), et continuité de l'encre le long du contour extérieur.
 */
export interface Pt { readonly x: number; readonly y: number }
export type Kind = 'bg' | 'neck' | 'other';
export interface LPt extends Pt { readonly kind: Kind }
export interface ContourStats {
  /** Longueur du contour extérieur analysé (U). */ readonly lengthU: number;
  /** Rayon de courbure minimal sur le contour extérieur (U) : un angle vif donne une valeur petite. */ readonly minRadiusU: number;
  /** Nombre d'inflexions significatives (changement de signe de la courbure, amplitude > tolérance). */ readonly inflections: number;
  /** Profondeur maximale (U) du creux entre le contour extérieur et son enveloppe convexe locale. */ readonly concavityU: number;
  /** Point le plus bas du contour extérieur (y image, U depuis le pivot) et abscisse. */ readonly lowest: Pt;
  /** Part des pixels du contour extérieur couverts par l'encre, et plus longue interruption (px). */ readonly inkFrac: number; readonly inkGapPx: number;
}

const HEAD = (id: number): boolean => id === PART.head;   // les bosses (nez, lèvres) sont des pièces à part : leur silhouette est légitimement sinueuse
const DIRS: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Contour (pixels ordonnés) du plus grand composant du masque `m`, par suivi de Moore. */
export function traceMask(m: Uint8Array, w: number, h: number): Pt[] {
  let sx = -1, sy = -1;
  for (let y = 0; y < h && sx < 0; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { sx = x; sy = y; break; }
  if (sx < 0) return [];
  const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  const out: Pt[] = [{ x: sx, y: sy }];
  let cx = sx, cy = sy, back = 4;   // on est entré par la gauche (direction 4 = −x)
  for (let guard = 0; guard < w * h; guard++) {
    let found = false;
    for (let i = 1; i <= 8; i++) {
      const d = (back + i) % 8, nx = cx + DIRS[d]![0], ny = cy + DIRS[d]![1];
      if (at(nx, ny)) { back = (d + 4 + 1) % 8; cx = nx; cy = ny; found = true; break; }
    }
    if (!found) break;
    if (cx === sx && cy === sy && out.length > 2) break;
    out.push({ x: cx, y: cy });
  }
  return out;
}

/** Rééchantillonne une polyligne à pas d'arc constant. */
export function resample(p: readonly Pt[], step: number): Pt[] {
  if (p.length < 2) return [...p];
  const o: Pt[] = [p[0]!]; let acc = 0;
  for (let i = 1; i < p.length; i++) {
    let a = p[i - 1]!; const b = p[i]!; let d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= step) { const t = (step - acc) / d; a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; o.push(a); d = Math.hypot(b.x - a.x, b.y - a.y); acc = 0; }
    acc += d;
  }
  return o;
}

/** Lissage binomial léger (retire la marche d'escalier des pixels sans effacer un angle réel). */
const smoothPts = (p: readonly Pt[], k: number): Pt[] => p.map((_, i) => {
  let sx = 0, sy = 0, sw = 0;
  for (let j = -k; j <= k; j++) { const q = p[Math.min(p.length - 1, Math.max(0, i + j))]!, wgt = k + 1 - Math.abs(j); sx += q.x * wgt; sy += q.y * wgt; sw += wgt; }
  return { x: sx / sw, y: sy / sw };
});

/** Courbure signée en chaque point (1/U) à partir de trois points espacés de `span` échantillons ; > 0 : tourne à droite de l'image. */
export function curvature(p: readonly Pt[], span: number, step: number): number[] {
  return p.map((_, i) => {
    if (i < span || i >= p.length - span) return 0;
    const a = p[i - span]!, b = p[i]!, c = p[i + span]!, ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
    const ang = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return ang / (span * step);
  });
}

/** Profondeur maximale du creux d'une polyligne par rapport à son enveloppe convexe (enveloppe des points, distance au segment d'enveloppe le plus proche). */
export function concavityDepth(p: readonly Pt[]): number {
  if (p.length < 4) return 0;
  const s = [...p].sort((a, b) => a.x - b.x || a.y - b.y), cr = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of s) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (let i = s.length - 1; i >= 0; i--) { const q = s[i]!; while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  const hull = [...lo.slice(0, -1), ...up.slice(0, -1)];
  let worst = 0;
  for (const q of p) {
    let best = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i]!, b = hull[(i + 1) % hull.length]!, dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L2));
      best = Math.min(best, Math.hypot(q.x - (a.x + dx * t), q.y - (a.y + dy * t)));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

/** Contour de la tête en U (repère image : x vers la droite, y vers le bas, depuis le pivot), points étiquetés : contre le fond, contre le cou, ou contre une autre pièce (oreille). */
export function headContour(r: TurnRender, stepU = 0.01): LPt[] {
  const m = new Uint8Array(r.w * r.h);
  for (let k = 0; k < m.length; k++) if (HEAD(r.ids[k]!)) m[k] = 1;
  const raw = traceMask(m, r.w, r.h);
  const kindOf = (q: Pt): Kind => {
    let neck = false, other = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = q.x + dx, y = q.y + dy;
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) return 'bg';
      const id = r.ids[y * r.w + x]!;
      if (id === 0) return 'bg';
      if (id === PART.neck || id === PART.neckCut) neck = true; else if (!HEAD(id)) other = true;
    }
    return neck ? 'neck' : other ? 'other' : 'bg';
  };
  const kinds = raw.map(kindOf), toU = (q: Pt): Pt => ({ x: (q.x - r.originX) / r.ppu, y: (q.y - r.originY) / r.ppu });
  const u = smoothPts(resample(raw.map(toU), stepU), 2);
  // Étiquette d'un point rééchantillonné = celle du pixel brut le plus proche en indice relatif.
  return u.map((q, i) => ({ x: q.x, y: q.y, kind: kinds[Math.min(kinds.length - 1, Math.round((i * (kinds.length - 1)) / Math.max(1, u.length - 1)))]! }));
}

export interface BandOpts { readonly yMinU: number; readonly yMaxU: number; readonly stepU?: number; readonly minRunU?: number; /** Couleur d'encre de la tête et tolérance (la planche : 73,56,49 ; 70). */ readonly ink?: readonly [number, number, number]; readonly inkTol?: number }

/** Statistiques du contour mâchoire/menton/joue : points hors oreille dont y image ∈ [yMinU, yMaxU]. Le coin concave mâchoire → cou (jonction fond/cou) est exclu des mesures de courbure. */
export function jawContourStats(r: TurnRender, band: BandOpts): ContourStats {
  const step = band.stepU ?? 0.01, span = 3, pts = headContour(r, step);
  // Sens de parcours : aire signée > 0 → courbure positive = virage convexe.
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; area += a.x * b.y - b.x * a.y; }
  const convexSign = Math.sign(area) || 1;
  let len = 0, minR = Infinity, infl = 0, conc = 0, low: Pt = { x: 0, y: -Infinity };
  let seg: LPt[] = [];
  const flush = (): void => {
    if (seg.length * step >= (band.minRunU ?? 0.12)) {
      len += seg.length * step; conc = Math.max(conc, concavityDepth(seg));
      const k = curvature(seg, span, step); let last = 0, cur = 0, run = 0;
      for (let i = span; i < k.length - span; i++) {
        const c = k[i]! * convexSign;
        if (c > 1e-6) minR = Math.min(minR, 1 / c);
        // Inflexion = changement de signe entre deux ARCS SOUTENUS (|courbure| > 3 /U, soit rayon < 0,33 U, pendant ≥ 3 échantillons) : une ligne droite bruitée n'en compte pas.
        const sg = Math.abs(c) > 3 ? Math.sign(c) : 0;
        if (sg !== 0 && sg === cur) run++; else { cur = sg; run = sg !== 0 ? 1 : 0; }
        if (run === 3) { if (last && cur !== last) infl++; last = cur; }
      }
      for (const q of seg) if (q.y > low.y) low = q;
    }
    seg = [];
  };
  let prev: Kind = 'other';
  for (const q of pts) {
    if (q.kind !== prev && q.kind !== 'other' && prev !== 'other') flush();   // jonction fond / cou : coin concave légitime, tronçons analysés séparément
    prev = q.kind;
    if (q.kind !== 'other' && q.y >= band.yMinU && q.y <= band.yMaxU) seg.push(q); else flush();
  }
  flush();
  const ink = inkContinuity(r, band);
  return { lengthU: len, minRadiusU: Number.isFinite(minR) ? minR : 0, inflections: infl, concavityU: conc, lowest: low, inkFrac: ink.frac, inkGapPx: ink.gap };
}

/** Continuité de l'encre sur le contour (fond ou cou) : pixel de bord couvert si un pixel proche (rayon 2) est de la couleur d'encre. */
export function inkContinuity(r: TurnRender, band: BandOpts, ink: readonly [number, number, number] = band.ink ?? [73, 56, 49]): { frac: number; gap: number } {
  let n = 0, covered = 0, gap = 0, run = 0;
  const isInk = (k: number): boolean => Math.hypot(r.rgba[4 * k]! - ink[0], r.rgba[4 * k + 1]! - ink[1], r.rgba[4 * k + 2]! - ink[2]) < (band.inkTol ?? 70);
  for (const q of headContour(r, 1 / r.ppu)) {
    if (q.kind === 'other' || q.y < band.yMinU || q.y > band.yMaxU) { run = 0; continue; }
    const px = Math.round(q.x * r.ppu + r.originX), py = Math.round(q.y * r.ppu + r.originY);
    let hit = false;
    for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2; dx++) { const x = px + dx, y = py + dy; if (x >= 0 && y >= 0 && x < r.w && y < r.h && isInk(y * r.w + x)) { hit = true; break; } }
    n++; if (hit) { covered++; run = 0; } else { run++; gap = Math.max(gap, run); }
  }
  return { frac: n ? covered / n : 1, gap };
}

/** Région peinte la plus basse de la tête (peau) : repère de « pendaison » indépendant du contour (y image en U). */
export function lowestSkinU(r: TurnRender): number {
  let low = -Infinity;
  for (let k = 0; k < r.w * r.h; k++) if (r.regions[k] === REGION.skin && HEAD(r.ids[k]!)) low = Math.max(low, Math.floor(k / r.w));
  return (low - r.originY) / r.ppu;
}

/** Bords gauche/droit de la TÊTE SEULE (ni cou, ni oreilles, ni bosses) aux hauteurs t (U depuis le sommet de la tête), en U depuis le pivot : comparables aux contours 2D du moteur de visage. */
export function headEdges(r: TurnRender, ts: readonly number[]): { t: number; left: number; right: number }[] {
  let top = -1;
  for (let y = 0; y < r.h && top < 0; y++) for (let x = 0; x < r.w; x++) if (HEAD(r.ids[y * r.w + x]!)) { top = y; break; }
  const out: { t: number; left: number; right: number }[] = [];
  if (top < 0) return out;
  for (const t of ts) {
    const y = Math.round(top + t * r.ppu); if (y >= r.h) continue;
    let l = -1, rr = -1;
    for (let x = 0; x < r.w; x++) if (HEAD(r.ids[y * r.w + x]!)) { if (l < 0) l = x; rr = x; }
    if (l >= 0) out.push({ t, left: (l - r.originX) / r.ppu, right: (rr + 1 - r.originX) / r.ppu });
  }
  return out;
}
