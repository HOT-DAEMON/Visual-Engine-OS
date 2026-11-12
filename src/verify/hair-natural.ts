import { faceLandmarks, type FaceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { coverageOf } from '../face/hair/sides';
import { TIE } from '../face/hair/tie';
import type { Poly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DES CHEVEUX « NATURELS » (`docs/HAIR-NATURAL.md`), trois couches, mesurée sur la géométrie pure (pas sur l'image) :
 *  - géométrie : le contour extérieur d'une masse ronde (afro / bouclé) est une boule — largeur croissante du sommet à l'équateur, sans cran ni marche ;
 *  - anatomie  : les deux oreilles d'une masse ronde sont couvertes de façon comparable ; un chignon a un rayon réel (0,08 W – borne de `TIE`) et dépasse assez du crâne pour se lire de face ;
 *  - style     : le chignon n'est pas un disque caché : au moins `bunVisible` de son contour est hors de la silhouette du crâne.
 * Seuils : mesures sur 60 visages par coiffure (`docs/HAIR-NATURAL-VERIFY.md`).
 */
export const NATURAL_LIMITS = {
  /** Cran du contour (largeur perdue entre le sommet et l'équateur, / W). */
  dent: 0.01,
  /** Écart de couverture entre les deux oreilles d'une masse ronde dont les deux côtés sont « cachés ». */
  earGap: 0.2,
  /** Rayon minimal d'un chignon / W (le maximal est `TIE`). */
  bunRadiusMin: 0.08,
  /** Part minimale du contour du chignon hors du crâne (de face). */
  bunVisible: 0.5,
} as const;

const ROUND = ['afro', 'curly'] as const;

/** Largeur [min x, max x] de `poly` à l'ordonnée y (intersections des arêtes), ou null. */
function widthAt(poly: Poly, y: number): number | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as { x: number; y: number }, b = poly[(i + 1) % poly.length] as { x: number; y: number };
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
  }
  return hi > lo ? hi - lo : null;
}

/** Cran du contour d'une masse ronde : largeur déjà atteinte moins largeur courante, maximum sur les niveaux entre le sommet et l'équateur (largeur maximale), / W. */
export function outlineDent(base: Poly, W: number): number {
  const ys = base.map((v) => v.y), top = Math.min(...ys), bot = Math.max(...ys);
  const N = 40, w: number[] = [];
  for (let i = 1; i < N; i++) w.push(widthAt(base, top + ((bot - top) * i) / N) ?? 0);
  const iMax = w.indexOf(Math.max(...w));
  let run = 0, dent = 0;
  for (let i = 0; i <= iMax; i++) { run = Math.max(run, w[i] as number); dent = Math.max(dent, run - (w[i] as number)); }
  return dent / W;
}

export interface BunMetrics { readonly radius: number; readonly visible: number }

/** Chignon : rayon moyen / W et part de son contour hors de la silhouette du crâne (de face). `null` sans chignon. */
export function bunMetrics(geo: HairGeometry, lm: FaceLandmarks): BunMetrics | null {
  const disc = geo.locks.find((l) => l.part === 'bun' && l.poly.length === 48)?.poly;
  if (!disc) return null;
  const cx = disc.reduce((a, q) => a + q.x, 0) / disc.length, cy = disc.reduce((a, q) => a + q.y, 0) / disc.length;
  const r = disc.reduce((a, q) => a + Math.hypot(q.x - cx, q.y - cy), 0) / disc.length;
  const S = geo.boundary.skull;
  const out = disc.filter((q) => q.y < S.topY || Math.abs(q.x) > S.a(q.y)).length / disc.length;
  return { radius: r / lm.W, visible: out };
}

/** `override` : géométrie à contrôler à la place de celle du visage (contrôles négatifs des tests). */
export function checkHairNatural(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const L = NATURAL_LIMITS, out: Check[] = [];
  if ((ROUND as readonly string[]).includes(p.hair.style) && geo.base[0]) {
    out.push(check('geometry', 'natural-outline-dent', '<=', outlineDent(geo.base[0], lm.W), L.dent, 'le contour de la masse a un cran entre le sommet et l\'équateur (marche)', 'warn'));
    const s = geo.sides;
    if (s.left.ear === 'covered' && s.right.ear === 'covered') {
      const c = (z: Poly): number => coverageOf(geo.front, z);
      out.push(check('anatomy', 'natural-ear-balance', '<=', Math.abs(c(s.left.earZone) - c(s.right.earZone)), L.earGap, 'une oreille est bien plus couverte que l\'autre', 'warn'));
    }
  }
  const bun = p.hair.style === 'bun' ? bunMetrics(geo, lm) : null;
  if (bun) {
    out.push(check('anatomy', 'bun-radius-min', '>=', bun.radius, L.bunRadiusMin, 'le chignon est trop petit pour se lire comme un chignon'));
    out.push(check('anatomy', 'bun-radius-max', '<=', bun.radius, Math.max(TIE.bunRadiusSide, TIE.bunRadiusTop), 'le chignon est plus gros que ne l\'admet la tête'));
    out.push(check('style', 'bun-visible', '>=', bun.visible, L.bunVisible, 'le chignon est presque entièrement caché par le crâne', 'warn'));
  }
  return out;
}
