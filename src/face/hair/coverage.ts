import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';

/**
 * GRILLE DE COUVERTURE : rastérise des polygones sur une grille régulière pour mesurer ce qu'ils recouvrent (coque nue, trous du dessus du crâne).
 * La règle est « nonzero », comme le rendu SVG des mèches (`orient` : l'union des formes d'un même calque est sans trou) ; la règle pair-impair de
 * `inPoly` sous-estimerait la couverture d'une mèche bouclée dont le contour se recoupe. Coût ∝ (sommets + cellules couvertes), sans test point-dans-polygone.
 */
export interface Grid {
  readonly x0: number;
  readonly y0: number;
  readonly cell: number;
  readonly nx: number;
  readonly ny: number;
}

/** Grille couvrant `poly` (marge de deux cellules), de pas `cell` px. */
export function gridOver(poly: Poly, cell: number): Grid {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of poly) {
    if (q.x < x0) x0 = q.x;
    if (q.x > x1) x1 = q.x;
    if (q.y < y0) y0 = q.y;
    if (q.y > y1) y1 = q.y;
  }
  return { x0: x0 - 2 * cell, y0: y0 - 2 * cell, cell, nx: Math.ceil((x1 - x0) / cell) + 4, ny: Math.ceil((y1 - y0) / cell) + 4 };
}

/** Centre de la cellule d'indice `idx`. */
export const centerOf = (g: Grid, idx: number): Vec => ({ x: g.x0 + ((idx % g.nx) + 0.5) * g.cell, y: g.y0 + (Math.floor(idx / g.nx) + 0.5) * g.cell });

/** Indice de la cellule contenant (x, y), ou −1 hors grille. */
export function indexAt(g: Grid, x: number, y: number): number {
  const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((y - g.y0) / g.cell);
  return i < 0 || j < 0 || i >= g.nx || j >= g.ny ? -1 : j * g.nx + i;
}

const scratch: { x: number; w: number }[] = [];

/** Marque (1) les cellules dont le centre est dans `poly` ; retourne le nombre de cellules NOUVELLEMENT marquées. */
export function paint(g: Grid, poly: Poly, data: Uint8Array): number {
  const n = poly.length;
  if (n < 3) return 0;
  let ymin = Infinity, ymax = -Infinity;
  for (const q of poly) {
    if (q.y < ymin) ymin = q.y;
    if (q.y > ymax) ymax = q.y;
  }
  const j0 = Math.max(0, Math.ceil((ymin - g.y0) / g.cell - 0.5)), j1 = Math.min(g.ny - 1, Math.floor((ymax - g.y0) / g.cell - 0.5));
  let added = 0;
  for (let j = j0; j <= j1; j++) {
    const y = g.y0 + (j + 0.5) * g.cell;
    scratch.length = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i] as Vec, b = poly[(i + 1) % n] as Vec;
      if (a.y <= y === b.y <= y) continue;
      scratch.push({ x: a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x), w: b.y > a.y ? 1 : -1 });
    }
    scratch.sort((p, q) => p.x - q.x);
    let w = 0;
    for (let k = 0; k < scratch.length - 1; k++) {
      w += (scratch[k] as { w: number }).w;
      if (w === 0) continue;
      const i0 = Math.max(0, Math.ceil(((scratch[k] as { x: number }).x - g.x0) / g.cell - 0.5)), i1 = Math.min(g.nx - 1, Math.floor(((scratch[k + 1] as { x: number }).x - g.x0) / g.cell - 0.5));
      for (let i = i0; i <= i1; i++) {
        const idx = j * g.nx + i;
        if (data[idx] === 0) { data[idx] = 1; added++; }
      }
    }
  }
  return added;
}
