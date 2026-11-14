import type { FaceLandmarks } from '../face/landmarks';
import type { HairGeometry, HairLock } from '../face/hair';
import type { HairPart, HairPlace } from './hair-volume-types';

/** Boîte englobante (px) des sommets d'un groupe de mèches. */
function box(ls: readonly HairLock[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const l of ls) for (const q of l.poly) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
  return { x0, x1, y0, y1 };
}

/** Où se pose une attache : dessus du crâne, flanc ou derrière (même découpage que `tieSpots` : `|x| ≥ 0,2 W` = latéral, sommet à moins de 0,06 H du vertex = dessus). */
function placeOf(x: number, y: number, W: number, H: number, topY: number): HairPlace {
  return Math.abs(x) >= 0.2 * W ? 'side' : y < topY + 0.06 * H ? 'top' : 'back';
}

/**
 * PIÈCES ATTACHÉES (chignon, queue, tresses) lues sur la géométrie du moteur de cheveux : point d'attache (`geo.ties`), taille et longueur mesurées sur les mèches `part`.
 * Une pièce n'est pas une coque : c'est un volume à part (sphère, tube) posé sur les sections du crâne par `hair-parts.ts`. Unités : U (`kU` = U par px, `toU` = ordonnée).
 */
export function hairPartsOf(geo: HairGeometry, lm: FaceLandmarks, kU: number, toU: (y: number) => number): HairPart[] {
  const { W, H } = lm, S = geo.boundary.skull, out: HairPart[] = [];
  const bun = geo.locks.filter((l) => l.part === 'bun'), tail = geo.locks.filter((l) => l.part === 'tail'), braid = geo.locks.filter((l) => l.part === 'braid');
  for (const T of geo.ties) {
    const place = placeOf(T.at.x, T.at.y, W, H, S.topY);
    if (bun.length) {
      const b = box(bun.length > 2 ? bun.filter((l) => l.poly.some((q) => Math.abs(q.x - T.at.x) < 0.3 * W)) : bun), r = Math.min(0.5 * Math.max(b.x1 - b.x0, b.y1 - b.y0), 0.22 * W) * kU;
      out.push({ kind: 'bun', x: T.at.x * kU, y: toU(T.at.y), r: Math.max(r, 0.04), place });
    } else if (tail.length) {
      const b = box(tail), len = Math.max(0.12, (b.y1 - T.at.y) * kU), r0 = Math.max(0.03, T.rx * 1.6 * kU);
      out.push({ kind: 'tail', x: T.at.x * kU, y: toU(T.at.y), len, r0, spread: Math.min(0.25, 0.5 * (b.x1 - b.x0) * kU), place });
    }
  }
  if (braid.length) {
    // Une tresse = un groupe de segments proches en x : regroupement par casier de 0,1 W.
    const bins = new Map<number, HairLock[]>();
    for (const l of braid) { const c = l.poly.reduce((s, q) => s + q.x, 0) / l.poly.length; const k = Math.round(c / (0.1 * W)); bins.set(k, [...(bins.get(k) ?? []), l]); }
    for (const ls of bins.values()) {
      const b = box(ls);
      out.push({ kind: 'braid', x: ((b.x0 + b.x1) / 2) * kU, y: toU(b.y0), len: Math.max(0.1, (b.y1 - b.y0) * kU), r: Math.max(0.02, Math.min(0.06, 0.5 * (b.x1 - b.x0) * kU)) });
    }
  }
  return out;
}
