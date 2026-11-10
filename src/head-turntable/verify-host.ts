import { halfWidthAt } from '../face/outline';
import { hex } from './color';
import { toEngineY } from './engines/rows';
import { py } from './engines/units';
import { hairlineY } from './sections';
import { PART } from './mesh';
import { REGION, type HeadTurnSpec, type HostEye, type TurnRender } from './types';
import { check, type Check } from './verify-types';

/**
 * RECOUVREMENT DE LA TÊTE 3D À 0° SUR LE VISAGE DE L'HÔTE (sans pivot : yaw 0, tangage 0 = la vue de face du dessin). Deux sources, jamais recopiées :
 *  - le contour du visage du moteur de repères (`spec.engine.lm.outline`, ce que le dessin de face trace) ;
 *  - les yeux POSÉS de l'hôte (`spec.eyeHost` : forme d'ouverture, iris, regard), mesurés contre les pixels de l'œil rendu.
 * Mesure sur l'IMAGE (ids, régions, couleurs) : c'est ce que l'on voit, pas la géométrie qui l'a produite.
 */
export interface HostOverlap {
  /** Part du visage de l'hôte (de la lisière frontale au menton, 92 % de la demi-largeur) peinte en peau / œil / bouche par la tête 3D : ni cheveux, ni fond, ni trou. */ readonly skinCover: number;
  /** Rangées comparées : dont les deux bords sont de la peau (là où la masse de cheveux, que le contour du visage ne contient pas, fait le bord, la rangée est écartée) et hors bande de l'oreille (le contour de face n'en a pas). */ readonly rows: number;
  /** Σ min(largeur 3D, largeur hôte) / Σ max(...) sur ces rangées : 1 = les deux silhouettes se superposent. */ readonly iou: number;
  /** Part de la largeur du visage de l'hôte recouverte par la tête 3D (Σ min / Σ hôte). */ readonly coverage: number;
}

/** Couverture de peau du visage de l'hôte (voir `HostOverlap.skinCover`) : balayage des pixels du rendu dans le polygone du visage, par rangée. */
function skinCover(spec: HeadTurnSpec, r: TurnRender): number {
  const e = spec.engine!, yTop = hairlineY(spec, 0) + 0.02, yBot = (spec.rows[spec.rows.length - 1]?.y ?? 1) - 0.03;
  let want = 0, got = 0;
  for (let y = Math.max(0, Math.ceil(yTop * r.ppu + r.originY)); y < Math.min(r.h, Math.floor(yBot * r.ppu + r.originY)); y++) {
    const uy = (y + 0.5 - r.originY) / r.ppu, hw = (0.92 * halfWidthAt(e.lm.outline, Math.min(py(toEngineY(uy)), e.lm.outline.bottomY - 1))) / 1000;
    for (let x = Math.ceil(r.originX - hw * r.ppu); x < Math.floor(r.originX + hw * r.ppu); x++) {
      want++; const g = r.regions[y * r.w + x];
      if (g === REGION.skin || g === REGION.eye || g === REGION.mouth) got++;
    }
  }
  return want ? got / want : 0;
}

/** Hauteurs (U) des rangées comparées : du front à la pointe du menton, pas 0,025. */
const ROWS = Array.from({ length: 35 }, (_, i) => 0.15 + i * 0.025);

export function hostOverlap(spec: HeadTurnSpec, r0: TurnRender): HostOverlap | null {
  const e = spec.engine;
  if (!e) return null;
  const e0 = spec.ear.y0 - 0.03, e1 = spec.ear.y1 + 0.03;
  let inter = 0, union = 0, host = 0, rows = 0;
  for (const t of ROWS) {
    if (t >= e0 && t <= e1) continue;
    const y = Math.round(t * r0.ppu + r0.originY - 0.5);
    if (y < 0 || y >= r0.h) continue;
    let l = -1, r = -1;
    for (let x = 0; x < r0.w; x++) if (r0.ids[y * r0.w + x] === PART.head) { if (l < 0) l = x; r = x; }   // la tête seule : ni cou, ni oreilles, ni bosses (comme `headEdges`)
    // Une rangée dont un bord est fait de cheveux n'est pas comparable : le contour du visage de l'hôte ne les contient pas.
    if (l < 0 || r0.regions[y * r0.w + l] === REGION.hair || r0.regions[y * r0.w + r] === REGION.hair) continue;
    const want = halfWidthAt(e.lm.outline, Math.min(py(toEngineY(t)), e.lm.outline.bottomY - 1)) / 1000, got = (r - l + 1) / 2 / r0.ppu;
    inter += Math.min(got, want); union += Math.max(got, want); host += want; rows++;
  }
  return { rows, iou: union ? inter / union : 0, coverage: host ? inter / host : 0, skinCover: skinCover(spec, r0) };
}

/** Centre de gravité et boîte des pixels `pred` d'un côté (U, repère tête). */
function blob(r: TurnRender, side: 1 | -1, pred: (i: number) => boolean, skip?: Uint8Array): { n: number; cx: number; cy: number; w: number; h: number } {
  let n = 0, sx = 0, sy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const k = y * r.w + x, ux = (x + 0.5 - r.originX) / r.ppu;
    if (r.regions[k] !== REGION.eye || ux * side <= 0 || skip?.[k] || !pred(4 * k)) continue;
    const uy = (y + 0.5 - r.originY) / r.ppu;
    n++; sx += ux; sy += uy; x0 = Math.min(x0, ux); x1 = Math.max(x1, ux); y0 = Math.min(y0, uy); y1 = Math.max(y1, uy);
  }
  return { n, cx: n ? sx / n : NaN, cy: n ? sy / n : NaN, w: x1 - x0, h: y1 - y0 };
}

export interface EyeOverlap {
  /** Distance (U) de chaque point des paupières de l'hôte (hors cil de bout) à l'encre rendue la plus proche : moyenne et maximum. Mesure d'un coup la forme, la taille et la position. */ readonly meanD: number; readonly maxD: number;
  /** Écart (U) entre le centre rendu de l'iris + pupille visibles et celui attendu (ellipse d'iris de l'hôte ∩ ouverture) : le regard. */ readonly gaze: number;
}

const inPoly = (poly: readonly { x: number; y: number }[], x: number, y: number): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; }
  return c;
};

/** Hauteur de la paupière supérieure de l'hôte à l'abscisse x (sommet le plus proche en x). */
const upperAt = (e: HostEye, x: number): number => { let b = e.upper[0]!, d = Infinity; for (const q of e.upper) { const dd = Math.abs(q.x - x); if (dd < d) { d = dd; b = q; } } return b.y; };

/**
 * Centre de gravité attendu de l'iris VISIBLE : ellipse d'iris de l'hôte recoupée par l'ouverture, moins ce que la peinture cache (le trait de paupière sur 0,0035 U sous la ligne, les deux reflets
 * de l'iris aux mêmes proportions que `eye-host-tex.ts`) : le rendu mesure des pixels, pas une géométrie idéale.
 */
function expectedIris(e: HostEye): { cx: number; cy: number } {
  const poly = [...e.upper, ...[...e.lower].reverse()], { iris: ir } = e, R = ir.rx;
  let n = 0, sx = 0, sy = 0;
  for (let i = -40; i <= 40; i++) for (let j = -40; j <= 40; j++) {
    const x = ir.cx + (i / 40) * ir.rx, y = ir.cy + (j / 40) * ir.ry;
    if ((i * i + j * j) / 1600 > 1 || !inPoly(poly, x, y) || y < upperAt(e, x) + 0.0035) continue;
    if (Math.hypot(x - ir.cx + 0.29 * R, y - ir.cy + 0.42 * R) < 0.26 * R || Math.hypot(x - ir.cx - 0.34 * R, y - ir.cy - 0.35 * R) < 0.11 * R) continue;
    n++; sx += x; sy += y;
  }
  return { cx: n ? sx / n : ir.cx, cy: n ? sy / n : ir.cy };
}

/** Points régulièrement espacés d'une polyligne (n points, du premier au dernier). */
function along(pl: readonly { x: number; y: number }[], n: number): { x: number; y: number }[] {
  const cum = [0]; for (let i = 1; i < pl.length; i++) cum.push(cum[i - 1]! + Math.hypot(pl[i]!.x - pl[i - 1]!.x, pl[i]!.y - pl[i - 1]!.y));
  return Array.from({ length: n }, (_, k) => { const d = (cum[cum.length - 1]! * k) / (n - 1); let i = 1; while (i < cum.length - 1 && cum[i]! < d) i++; const t = (d - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1); return { x: pl[i - 1]!.x + t * (pl[i]!.x - pl[i - 1]!.x), y: pl[i - 1]!.y + t * (pl[i]!.y - pl[i - 1]!.y) }; });
}

/** Œil rendu à 0° vs œil de l'hôte, d'un côté (`side` = +1 : x > 0). */
export function eyeOverlap(spec: HeadTurnSpec, r0: TurnRender, side: 1 | -1): EyeOverlap | null {
  const E = spec.eyeHost;
  if (!E) return null;
  const e = side > 0 ? E.right : E.left, ink = hex(spec.palette.ink), ppu = r0.ppu;
  const isInk = (k: number): boolean => Math.hypot(r0.rgba[4 * k]! - ink[0], r0.rgba[4 * k + 1]! - ink[1], r0.rgba[4 * k + 2]! - ink[2]) <= 60;
  const sclera = (i: number): boolean => r0.rgba[i]! > 205 && r0.rgba[i + 1]! > 210 && r0.rgba[i + 2]! > 215;   // blanc et ombre de paupière
  const iris = blob(r0, side, (i) => !sclera(i) && Math.hypot(r0.rgba[i]! - ink[0], r0.rgba[i + 1]! - ink[1], r0.rgba[i + 2]! - ink[2]) > 60), want = expectedIris(e);
  // Distance à l'encre : fenêtre de ± 0,03 U autour du point (px), pixels d'encre de la région œil.
  const R = Math.ceil(0.03 * ppu), dists: number[] = [];
  for (const q of [...along(e.upper, 18).slice(2, 16), ...along(e.lower, 18).slice(2, 16)]) {
    const cx = Math.round(r0.originX + side * q.x * ppu - 0.5), cy = Math.round(r0.originY + q.y * ppu - 0.5);
    let best = Infinity;
    for (let y = Math.max(0, cy - R); y <= Math.min(r0.h - 1, cy + R); y++) for (let x = Math.max(0, cx - R); x <= Math.min(r0.w - 1, cx + R); x++) {
      const k = y * r0.w + x; if (r0.regions[k] === REGION.eye && isInk(k)) best = Math.min(best, Math.hypot(x - cx, y - cy));
    }
    dists.push(best / ppu);
  }
  return { meanD: dists.reduce((a, b) => a + b, 0) / dists.length, maxD: Math.max(...dists), gaze: Math.hypot(Math.abs(iris.cx) - want.cx, iris.cy - want.cy) };
}

/** Contrôles de recouvrement, mêmes contrats que `verify-types.ts` : géométrie (silhouette), anatomie (yeux : position, taille, regard). */
export function hostChecks(spec: HeadTurnSpec, r0: TurnRender): { geometry: Check[]; anatomy: Check[] } {
  const g: Check[] = [], a: Check[] = [], o = hostOverlap(spec, r0);
  if (o) {
    g.push(check('geometry', 'head.host.front.iou', 'Recouvrement à 0° : IoU des largeurs 3D / visage de l\'hôte, front → menton hors oreille [mesuré 0,97–0,998 sur 8 visages]', o.iou, 0.95, 1));
    g.push(check('geometry', 'head.host.front.skin', 'Recouvrement à 0° : part du visage de l\'hôte (lisière → menton) peinte en peau, œil ou bouche (ni cheveux, ni fond, ni trou)', o.skinCover, 0.97, 1));
    g.push(check('geometry', 'head.host.front.coverage', 'Recouvrement à 0° : part de la largeur du visage de l\'hôte recouverte par la tête 3D', o.coverage, 0.96, 1));
  }
  for (const [side, name] of [[1, 'right'], [-1, 'left']] as const) {
    const m = eyeOverlap(spec, r0, side);
    if (!m) continue;
    a.push(check('anatomy', `head.host.eye.${name}.outline`, `Œil ${name} à 0° : distance moyenne (U) des paupières de l'hôte à l'encre rendue (forme, taille, position ; le trait fait ≈ 0,011)`, m.meanD, 0, 0.004));
    a.push(check('anatomy', `head.host.eye.${name}.outline-max`, `Œil ${name} à 0° : distance maximale (U) des paupières de l'hôte à l'encre rendue`, m.maxD, 0, 0.015));
    a.push(check('anatomy', `head.host.eye.${name}.gaze`, `Œil ${name} à 0° : écart (U) entre le centre de l'iris rendu et celui attendu : le regard de l'hôte`, m.gaze, 0, 0.02));
  }
  return { geometry: g, anatomy: a };
}
