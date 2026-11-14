import { centerOf, gridOver, paint } from '../face/hair/coverage';
import type { HairGeometry } from '../face/hair';
import type { Poly } from '../face/poly';

/** Silhouette de la masse de cheveux vue de face, ligne par ligne (px de l'hôte, x = 0 au centre) : bords gauche `xl` et droit `xr`. */
export interface SilRows { readonly y: number[]; readonly xl: number[]; readonly xr: number[] }

/**
 * SILHOUETTE DE LA COIFFURE lue sur la GÉOMÉTRIE du moteur de cheveux (sous-couche, masse arrière, mèches du dessus) : c'est le contour que la tête de face dessine, donc le volume 3D
 * l'épouse à 0°. Exclus : le duvet (`wisp`, brins isolés), les mèches qui passent devant le visage (`over`, déjà dans le visage) et les pièces attachées (queue, chignon, tresse : elles
 * deviennent des pièces 3D à part, `hair-parts.ts`). Grille de `cell` × W : une cellule couverte = cheveux.
 */
export function silhouetteRows(geo: HairGeometry, W: number, cell = 0.006): SilRows | null {
  const polys: Poly[] = [...geo.base, ...(geo.backBase ? [geo.backBase] : []), ...geo.locks.filter((l) => l.layer !== 'over' && l.kind !== 'wisp' && !l.part).map((l) => l.poly)];
  const all = polys.flat();
  if (all.length < 3) return null;
  const g = gridOver(all, cell * W), sil = new Uint8Array(g.nx * g.ny);
  for (const q of polys) paint(g, q, sil);
  const y: number[] = [], xl: number[] = [], xr: number[] = [];
  for (let j = 0; j < g.ny; j++) {
    let a = Infinity, b = -Infinity;
    for (let i = 0; i < g.nx; i++) if (sil[j * g.nx + i]) { const c = centerOf(g, j * g.nx + i); if (c.x < a) a = c.x; if (c.x > b) b = c.x; }
    if (b > a) { y.push(g.y0 + (j + 0.5) * g.cell); xl.push(a); xr.push(b); }
  }
  return y.length >= 8 ? { y, xl, xr } : null;
}

/** Valeur interpolée d'une colonne de la silhouette à l'ordonnée `y` ; hors des lignes : `outside`. */
export function sampleRows(rows: SilRows, col: 'xl' | 'xr', y: number, outside: number): number {
  const ys = rows.y, v = rows[col], n = ys.length;
  if (y < ys[0]! || y > ys[n - 1]!) return outside;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ys[m]! <= y) lo = m; else hi = m; }
  const t = (y - ys[lo]!) / (ys[hi]! - ys[lo]! || 1);
  return v[lo]! + (v[hi]! - v[lo]!) * t;
}
