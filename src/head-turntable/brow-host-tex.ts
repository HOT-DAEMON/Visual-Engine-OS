import { hex, mix } from './color';
import { distPolyline, inPoly } from './engines/face-parts';
import { REGION, type HostBrow, type HostEyes, type V3 } from './types';
import type { Pal, Tex } from './face-tex';

/** Données dérivées d'un sourcil d'hôte, calculées UNE fois (le peintre les lit à chaque pixel du visage) : contour fermé (pour la distance), boîte, couleur. */
interface Prep { readonly closed: { x: number; y: number }[]; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly rgb: ReturnType<typeof hex> }
const PREP = new WeakMap<HostBrow, Prep>();
function prep(b: HostBrow): Prep {
  let r = PREP.get(b);
  if (!r) {
    const xs = b.outline.map((q) => q.x), ys = b.outline.map((q) => q.y);
    PREP.set(b, (r = { closed: [...b.outline, b.outline[0]!], x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), rgb: hex(b.color) }));
  }
  return r;
}

/**
 * Sourcil de l'HÔTE peint sur la surface du visage (coordonnées tête, orthographique le long de z : à 0° il se superpose au sourcil du dessin de face).
 * Forme, longueur, arcade, inclinaison, pincement, épaisseur et queue effilée = ceux de `geometry/eye/browGeometry` (le moteur de sourcil du dessin de face) ; couleur = matériau de l'hôte.
 * Style cel de la tête : remplissage de la teinte du sourcil (légèrement assombrie, pour rester lisible sur une peau claire comme sur une peau foncée), filet d'encre fin le long du bord, à l'intérieur du contour.
 * `null` si l'hôte n'a pas de sourcil de ce côté : AUCUN sourcil n'est inventé (l'ancien arc de la planche n'est plus peint pour un hôte).
 */
export function browTexHost(E: HostEyes, p: V3, k: number, pal: Pal): Tex | null {
  const b = (p.x >= 0 ? E.right : E.left).brow;
  if (!b) return null;
  const g = prep(b), x = Math.abs(p.x), y = p.y;
  if (x < g.x0 - 0.01 || x > g.x1 + 0.01 || y < g.y0 - 0.01 || y > g.y1 + 0.01) return null;
  const inside = inPoly(b.outline as { x: number; y: number }[], x, y), d = distPolyline(g.closed, x, y, 0.01);
  if (!inside) return null;   // le filet d'encre est tracé À L'INTÉRIEUR du contour : le sourcil rendu a l'épaisseur de celui de l'hôte (un filet centré sur le bord épaississait de 0,0056 U les sourcils fins : aire × 2,3)
  return d < 0.0028 * k ? { c: pal.ink, region: REGION.brow, ink: true } : { c: mix(g.rgb, pal.ink, 0.22), region: REGION.brow };
}
