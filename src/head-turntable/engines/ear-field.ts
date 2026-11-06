import { memoPure } from '../../perf';
import type { EarModel, PlacedStructure } from '../../face/ear/types';
import type { Poly } from '../../face/poly';
import { inPoly } from '../../face/poly';
import { smooth } from '../math';

/** Champs scalaires du PLAN de l'oreille (u avant → arrière, v haut → bas), échantillonnés une fois par modèle : relief, structure dominante, distance aux arêtes d'encre. */
export interface EarField {
  readonly nx: number; readonly ny: number; readonly res: number; readonly wr: number;
  /** Relief signé (unités d'épaisseur) : la plaque = 0, l'hélix ≈ +0,9, la conque ≈ −0,6. `NaN` hors du contour. */
  readonly rel: Float32Array;
  /** Indice (1-based) de la structure dominante ; 0 = plaque nue ; 255 = hors du contour. */
  readonly lab: Uint8Array;
  /** Distance (unités du plan) à l'arête d'une structure « tracée » (trait d'encre du style anime) ; grande hors des arêtes. */
  readonly ink: Float32Array;
  readonly names: readonly string[];
}

/** Structures dont l'ARÊTE est tracée à l'encre dans le style de la planche (hélix intérieur, anthélix, tragus, antitragus, conque, crus). */
const INKED = new Set(['helix', 'antihelix:body', 'antihelix:upper', 'antihelix:lower', 'tragus', 'antitragus', 'cavum', 'crus']);
const EDGE_SOFT = 0.03;

const dEdge = (p: Poly, x: number, y: number): number => {
  let m = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!, vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    m = Math.min(m, Math.hypot(x - a.x - t * vx, y - a.y - t * vy));
  }
  return m;
};

function bakeRaw(m: EarModel, res: number): EarField {
  const wr = m.widthRatio, nx = Math.ceil(wr * res) + 1, ny = res + 1, order = [...m.structures].sort((a, b) => a.relief - b.relief);
  const rel = new Float32Array(nx * ny), lab = new Uint8Array(nx * ny), ink = new Float32Array(nx * ny).fill(9);
  const names = order.map((s) => String(s.id));
  const inked: Poly[] = order.filter((s) => INKED.has(String(s.id))).map((s) => s.poly);
  const boxes = order.map((s) => { const xs = s.poly.map((q) => q.x), ys = s.poly.map((q) => q.y); return { x0: Math.min(...xs) - EDGE_SOFT, x1: Math.max(...xs) + EDGE_SOFT, y0: Math.min(...ys) - EDGE_SOFT, y1: Math.max(...ys) + EDGE_SOFT }; });
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i / res, y = j / res, k = j * nx + i;
    if (!inPoly(m.outline, x, y)) { rel[k] = NaN; lab[k] = 255; continue; }
    let h = 0, l = 0;
    order.forEach((s: PlacedStructure, si) => {
      const b = boxes[si]!;
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1 || !inPoly(s.poly, x, y)) return;
      h = h + (s.relief - h) * smooth(dEdge(s.poly, x, y) / EDGE_SOFT); l = si + 1;
    });
    rel[k] = h; lab[k] = l;
    let d = 9; for (const p of inked) d = Math.min(d, dEdge(p, x, y)); ink[k] = d;
  }
  return { nx, ny, res, wr, rel, lab, ink, names };
}

/** Champ de l'oreille (mémoïsé par modèle : un EarModel est lui-même mémoïsé par contenu, donc l'identité suffit). */
const cache = new WeakMap<EarModel, EarField>();
export function earField(m: EarModel, res = 200): EarField {
  let f = cache.get(m); if (!f) { f = bakeRaw(m, res); cache.set(m, f); } return f;
}
void memoPure;

/** Échantillonnage bilinéaire du relief (hors contour : plus proche valeur finie). */
export function reliefAt(f: EarField, u: number, v: number): number {
  const x = Math.max(0, Math.min(f.nx - 1.001, u * f.res)), y = Math.max(0, Math.min(f.ny - 1.001, v * f.res)), i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
  const g = (a: number, b: number): number => { const r = f.rel[b * f.nx + a]!; return Number.isNaN(r) ? 0.9 : r; };
  return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - ty) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * ty;
}
/** Distance d'encre interpolée bilinéairement (ligne continue, sans crénelage). */
export function inkAt(f: EarField, u: number, v: number): number {
  const x = Math.max(0, Math.min(f.nx - 1.001, u * f.res)), y = Math.max(0, Math.min(f.ny - 1.001, v * f.res)), i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j, g = (a: number, b: number): number => f.ink[b * f.nx + a]!;
  return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - ty) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * ty;
}
/** Texel le plus proche : structure, distance d'encre, relief. */
export function texelAt(f: EarField, u: number, v: number): { lab: number; ink: number; rel: number } {
  const i = Math.max(0, Math.min(f.nx - 1, Math.round(u * f.res))), j = Math.max(0, Math.min(f.ny - 1, Math.round(v * f.res))), k = j * f.nx + i;
  return { lab: f.lab[k]!, ink: f.ink[k]!, rel: f.rel[k]! };
}
