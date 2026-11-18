import type { Vec } from '../geometry/eye/primitives';

/**
 * RECOUVREMENT DE MÈCHES (`docs/ROTATION-HAIR-PASS-8.md`) : combien de mèches se superposent en un même point de l'image. Les polygones de mèche sont remplis sur une grille grossière (cellule = `cell` px, remplissage
 * pair-impair par rangée) et on compte, par cellule, le nombre de mèches qui la couvrent. Une pose qui empile les mèches du côté proche (pente de la projection ≈ 0 au limbe) et qui superpose des semi-transparences
 * donne un comptage bien plus haut que la vue de face : c'est la règle de style « recouvrements » attendue depuis `ROTATION-HAIR-VERIFY-2.md` §4.
 */
export interface Cover {
  readonly nx: number;
  readonly ny: number;
  readonly count: Uint16Array;
}

export function strandCover(polys: readonly (readonly Vec[])[], x0: number, y0: number, x1: number, y1: number, cell: number): Cover {
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), ny = Math.max(1, Math.ceil((y1 - y0) / cell)), count = new Uint16Array(nx * ny);
  for (const poly of polys) {
    const rows: number[][] = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i] as Vec, b = poly[(i + 1) % n] as Vec;
      if (a.y === b.y) continue;
      const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
      const j0 = Math.max(0, Math.ceil((lo - y0) / cell - 0.5)), j1 = Math.min(ny - 1, Math.floor((hi - y0) / cell - 0.5));
      for (let j = j0; j <= j1; j++) {
        const y = y0 + (j + 0.5) * cell;
        if (y < lo || y >= hi) continue;
        (rows[j] ??= []).push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
      }
    }
    rows.forEach((xs, j) => {
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil(((xs[k] as number) - x0) / cell - 0.5)), c1 = Math.min(nx - 1, Math.floor(((xs[k + 1] as number) - x0) / cell - 0.5));
        for (let c = c0; c <= c1; c++) count[j * nx + c] = (count[j * nx + c] as number) + 1;
      }
    });
  }
  return { nx, ny, count };
}

/** Percentile `p` (0…1) du comptage parmi les cellules couvertes par au moins une mèche ; 0 si rien n'est couvert. */
export function coverPercentile(c: Cover, p: number): number {
  const v: number[] = [];
  for (let i = 0; i < c.count.length; i++) if ((c.count[i] as number) > 0) v.push(c.count[i] as number);
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))] as number;
}

/** Empilement des mèches d'une chevelure : p95 du comptage, cellule de 0,01 W, sur la boîte de la tête et des cheveux. */
export function stackDepth(polys: readonly (readonly Vec[])[], W: number, H: number): number {
  const c = strandCover(polys, -0.95 * W, -0.62 * H, 0.95 * W, 0.62 * H, 0.01 * W);
  return coverPercentile(c, 0.95);
}

/**
 * Part (0…1) du VISAGE couverte par des mèches : cellules de la zone de visage (sous la limite des sourcils jusqu'au menton, sur `share` de la demi-largeur de la silhouette à chaque ordonnée : on exclut la bande latérale
 * où se posent tempes, oreilles et pattes) couvertes par au moins une mèche, divisées par le nombre de cellules de la zone. C'est ce qu'une mèche qui « traverse la joue » ajoute.
 */
export function faceCoverage(polys: readonly (readonly Vec[])[], W: number, browY: number, chinY: number, halfAt: (y: number) => number, share: number): number {
  const cell = 0.01 * W, c = strandCover(polys, -0.95 * W, browY, 0.95 * W, chinY, cell);
  let zone = 0, hit = 0;
  for (let j = 0; j < c.ny; j++) {
    const y = browY + (j + 0.5) * cell, hw = share * halfAt(y);
    for (let i = 0; i < c.nx; i++) {
      const x = -0.95 * W + (i + 0.5) * cell;
      if (Math.abs(x) > hw) continue;
      zone++;
      if ((c.count[j * c.nx + i] as number) > 0) hit++;
    }
  }
  return zone ? hit / zone : 0;
}
