import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle } from '../../schema';
import { inPoly, type Poly } from '../poly';
import type { SkullSurface } from './boundary';
import { distanceOutsideSkull } from './thickness';
import type { HairLock } from './types';

type Style = Exclude<HairStyle, 'bald'>;

/**
 * LISIÈRE EXTÉRIEURE des volumes (`docs/HAIR-EDGE.md`) : afro et bouclé ont une silhouette de MASSE, pas de pointes. Mesuré avant : les mèches qui dépassent de la
 * coque faisaient un bord en DENTS DE SCIE (pointes qui sortent de 0,05 à 0,3 W, éclats anguleux, épis en cône) sur toute la couronne.
 * Remède : tout sommet de mèche qui dépasse la coque de plus de `RIM.margin` (fraction de W) est ramené au point le plus proche du contour de la coque, décalé de la marge. Une mèche
 * qui dépasse n'est donc pas coupée net : son bout épouse le contour (bord lisse et dense) ; il reste `margin` de duvet. Les mèches « flyaway » (`wisp`) sont exclues : ce sont
 * elles qui donnent le duvet voulu. Sous le niveau de la tempe (ailes sur les oreilles, nuque), rien n'est touché.
 */
export const RIM: Partial<Record<Style, { readonly margin: number }>> = {
  afro: { margin: 0.022 },
  curly: { margin: 0.018 },
};

/** Point de la polyligne fermée `poly` le plus proche de `p`, avec la distance. */
function nearestOnBoundary(poly: Poly, p: Vec): { q: Vec; d: number } {
  let best = Infinity;
  let bq: Vec = p;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec, b = poly[(i + 1) % poly.length] as Vec;
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
    const qx = a.x + t * vx, qy = a.y + t * vy;
    const d = (p.x - qx) ** 2 + (p.y - qy) ** 2;
    if (d < best) { best = d; bq = { x: qx, y: qy }; }
  }
  return { q: bq, d: Math.sqrt(best) };
}

/**
 * Mèches avec les sommets qui dépassent la coque de plus de `margin` (px) ramenés au contour décalé de `margin` (au-dessus de `yMax`, hors crâne).
 * Retourne les MÊMES objets quand rien ne dépasse (aucune copie inutile). Les `wisp`, `cheek`, `occluder` et mèches non frontales restent intactes (duvet).
 */
export function trimToRim(base: Poly, skull: SkullSurface, locks: readonly HairLock[], margin: number, yMax: number): HairLock[] {
  return locks.map((l) => {
    if (l.kind === 'wisp' || l.kind === 'cheek' || l.kind === 'occluder' || l.layer !== 'front') return l;
    let out: Poly | null = null;
    for (let k = 0; k < l.poly.length; k++) {
      const v = l.poly[k] as Vec;
      // Dans la coque OU dans le crâne (frange, mèches du front) : intact — seul ce qui dépasse le VOLUME est ramené.
      if (v.y > yMax || inPoly(base, v.x, v.y) || distanceOutsideSkull(skull, v) === 0) continue;
      const { q, d } = nearestOnBoundary(base, v);
      if (d <= margin) continue;
      if (!out) out = [...l.poly];
      // Sur le contour, puis `margin` vers l'extérieur le long de la direction d'origine.
      out[k] = { x: q.x + ((v.x - q.x) / d) * margin, y: q.y + ((v.y - q.y) / d) * margin };
    }
    return out ? { ...l, poly: out } : l;
  });
}
