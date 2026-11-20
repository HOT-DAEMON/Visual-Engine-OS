import type { V2 } from './vec';

/**
 * Trame d'analyse de la composition : une grille de cellules (en repère image) sur laquelle les lames sont rasterisées.
 * Sert aux mesures de masses, d'espaces négatifs, de densité et de lignes de force (`compose.ts`) — rien n'est dessiné ici.
 */
export interface Grid { readonly nx: number; readonly ny: number; readonly cell: number; readonly data: Uint8Array }

export const makeGrid = (w: number, h: number, cell = 3): Grid => ({ nx: Math.ceil(w / cell), ny: Math.ceil(h / cell), cell, data: new Uint8Array(Math.ceil(w / cell) * Math.ceil(h / cell)) });

/** Remplit (règle pair-impair, balayage par rangée sur le centre des cellules) un polygone ; `mode` : 'max' (couverture) ou 'add' (empilement, plafonné à 255). */
export function fillPoly(g: Grid, poly: readonly V2[], value = 1, mode: 'max' | 'add' = 'max'): void {
  let y0 = Infinity; let y1 = -Infinity; for (const p of poly) { if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const r0 = Math.max(0, Math.floor(y0 / g.cell - 0.5)); const r1 = Math.min(g.ny - 1, Math.ceil(y1 / g.cell - 0.5));
  for (let r = r0; r <= r1; r++) {
    const y = (r + 0.5) * g.cell; const xs: number[] = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i] as V2; const b = poly[j] as V2;
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] as number) / g.cell - 0.5)); const c1 = Math.min(g.nx - 1, Math.floor((xs[k + 1] as number) / g.cell - 0.5));
      for (let c = c0; c <= c1; c++) { const i = r * g.nx + c; g.data[i] = mode === 'add' ? Math.min(255, (g.data[i] as number) + value) : Math.max(g.data[i] as number, value); }
    }
  }
}

/** Dilatation (disque de rayon `r` cellules) puis, éventuellement, érosion : la FERMETURE comble les petits trous et trace l'enveloppe. */
export function morph(g: Grid, r: number, op: 'dilate' | 'erode'): Grid {
  const out = makeGrid(g.nx * g.cell, g.ny * g.cell, g.cell); const want = op === 'dilate' ? 1 : 0;
  for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) {
    let hit = false;
    for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const xx = x + dx; const yy = y + dy;
      const v = xx < 0 || yy < 0 || xx >= g.nx || yy >= g.ny ? (op === 'dilate' ? 0 : 1) : (g.data[yy * g.nx + xx] as number) > 0 ? 1 : 0;
      if (v === want) { hit = true; break; }
    }
    out.data[y * g.nx + x] = op === 'dilate' ? (hit ? 1 : 0) : hit ? 0 : 1;
  }
  return out;
}
export const close = (g: Grid, r: number): Grid => morph(morph(g, r, 'dilate'), r, 'erode');

export interface Blob { readonly cells: number; readonly cx: number; readonly cy: number; readonly aspect: number; readonly angle: number }

/** Composantes connexes (4-voisinage) des cellules où `pred` est vrai : aire, centre, allongement (λ1/λ2) et axe principal (rad, modulo π). */
export function blobs(g: Grid, pred: (i: number) => boolean): Blob[] {
  const seen = new Uint8Array(g.data.length); const out: Blob[] = [];
  for (let s = 0; s < g.data.length; s++) {
    if (seen[s] || !pred(s)) continue;
    const st = [s]; seen[s] = 1; const pts: [number, number][] = [];
    while (st.length) {
      const i = st.pop() as number; const x = i % g.nx; const y = (i / g.nx) | 0; pts.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const xx = x + dx; const yy = y + dy; if (xx < 0 || yy < 0 || xx >= g.nx || yy >= g.ny) continue; const j = yy * g.nx + xx; if (!seen[j] && pred(j)) { seen[j] = 1; st.push(j); } }
    }
    const n = pts.length; const cx = pts.reduce((a, p) => a + p[0], 0) / n; const cy = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxx = 0; let syy = 0; let sxy = 0; for (const [x, y] of pts) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
    sxx /= n; syy /= n; sxy /= n; const tr = sxx + syy; const det = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy));
    const l1 = tr / 2 + det + 1 / 12; const l2 = Math.max(1 / 12, tr / 2 - det + 1 / 12);
    out.push({ cells: n, cx: (cx + 0.5) * g.cell, cy: (cy + 0.5) * g.cell, aspect: Math.sqrt(l1 / l2), angle: 0.5 * Math.atan2(2 * sxy, sxx - syy) });
  }
  return out;
}
