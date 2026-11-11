import type { Poly } from '../poly';

/**
 * MESURE de silhouette partagée par l'ajustement sur références et par les tests : profil de largeur à 25 niveaux (du haut, 0, au bas, 1),
 * normalisé par la plus grande largeur, et rapport largeur / hauteur de la boîte englobante. Même définition que
 * `scripts/nose-refs/extract_06.py` (largeur = distance entre le premier et le dernier croisement de la ligne horizontale avec le contour).
 */
export interface WidthProfile { readonly profile: readonly number[]; readonly aspect: number; readonly width: number; readonly height: number }

/** Largeur (max − min des abscisses de croisement) du polygone à la hauteur y ; 0 si la ligne ne le coupe pas. */
function widthAt(poly: Poly, y: number): number {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    if ((a.y <= y && y < b.y) || (b.y <= y && y < a.y)) { const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  }
  return hi > lo ? hi - lo : 0;
}

export function widthProfile25(poly: Poly): WidthProfile {
  const ys = poly.map((q) => q.y), xs = poly.map((q) => q.x);
  const y0 = Math.min(...ys), y1 = Math.max(...ys), w = Math.max(...xs) - Math.min(...xs), h = y1 - y0;
  const profile = Array.from({ length: 25 }, (_, i) => widthAt(poly, y0 + (0.02 + (0.96 * i) / 24) * h) / w);
  return { profile, aspect: w / h, width: w, height: h };
}
