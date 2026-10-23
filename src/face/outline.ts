import { cubicAt, type Cubic, type Vec } from '../geometry/eye/primitives';
import { num } from '../core/svg';
import { lowerContour } from './jaw/contour';
import type { FaceParams } from '../schema';

/**
 * Contour du crâne + mâchoire + menton (géométrie pure, sans SVG). Repère local de l'hôte : origine au centre, x vers la droite,
 * y vers le bas ; le HAUT est à -H/2 et, bouche fermée, le BAS à H/2 (bouche ouverte, la mandibule s'abaisse : `bottomY` > H/2).
 * Le contour est symétrique : on ne construit que la moitié DROITE (du sommet au menton), la gauche en est le miroir.
 * Cinq cubiques raccordées en tangente : sommet → temple (le plus large), puis le contour bas de `jaw/contour.ts`
 * (ramus, coin de mâchoire arrondi selon l'angle mandibulaire, corps de la mandibule, symphyse du menton).
 */
const KAPPA = 0.5523; // contrôle d'un quart d'ellipse par une cubique

export interface Outline {
  /** Moitié droite, du sommet (0, -H/2) au centre du bas du menton (0, bottomY). */
  readonly right: readonly Cubic[];
  readonly W: number;
  readonly H: number;
  /** Demi-largeur du menton au coin (là où le corps de la mandibule rejoint la symphyse). */
  readonly chinHalf: number;
  /** Demi-largeur de menton demandée avant le plancher de continuité (`chinHalf` ≥ cette valeur). */
  readonly chinHalfRequested: number;
  /** Ordonnée du bas du menton : H/2 bouche fermée, plus bas quand la mandibule s'abaisse. */
  readonly bottomY: number;
  /** Points clés du contour bas, pour les repères et la vérification. */
  readonly keys: { readonly gonion: Vec; readonly chinCorner: Vec; readonly bottom: Vec };
}

export function headOutline(p: FaceParams, W: number, H: number): Outline {
  const top: Vec = { x: 0, y: -H / 2 };
  const temple: Vec = { x: W / 2, y: -H / 2 + p.templeY * H };
  const seg1: Cubic = {
    p0: top,
    p1: { x: KAPPA * temple.x, y: top.y },
    p2: { x: temple.x, y: temple.y - KAPPA * (temple.y - top.y) },
    p3: temple,
  };
  const low = lowerContour(p, W, H, temple);
  return { right: [seg1, ...low.segments], W, H, chinHalf: low.chinHalf, chinHalfRequested: low.chinHalfRequested, bottomY: low.bottom.y, keys: { gonion: low.gonion, chinCorner: low.chinCorner, bottom: low.bottom } };
}

const mirror = (v: Vec): Vec => ({ x: -v.x, y: v.y });

/** Chemin SVG fermé du contour complet (droite descendante, centre du bas du menton, gauche montante). */
export function outlinePath(o: Outline): string {
  const f = (v: Vec): string => `${num(v.x)} ${num(v.y)}`;
  const down = (c: Cubic): string => `C${f(c.p1)} ${f(c.p2)} ${f(c.p3)}`;
  const up = (c: Cubic): string => `C${f(mirror(c.p2))} ${f(mirror(c.p1))} ${f(mirror(c.p0))}`;
  const first = o.right[0] as Cubic;
  // Descente côté droit jusqu'au centre du bas du menton, puis montée côté gauche (segments parcourus à l'envers et en miroir).
  return `M${f(first.p0)}${o.right.map(down).join('')}${[...o.right].reverse().map(up).join('')}Z`;
}

const SAMPLE_CACHE = new WeakMap<Outline, Map<number, Vec[]>>();

/**
 * Échantillons (x, y) de la moitié droite, y croissant. MÉMOÏSÉS par contour (un `Outline` est immuable) : mesuré au profil, le recalcul à chaque appel de
 * `halfWidthAt` représentait ~27 % du temps de la vérification d'un visage. Le tableau renvoyé est partagé : ne pas le modifier.
 */
export function rightSamples(o: Outline, perSegment = 48): Vec[] {
  let byRes = SAMPLE_CACHE.get(o);
  if (!byRes) SAMPLE_CACHE.set(o, (byRes = new Map()));
  const hit = byRes.get(perSegment);
  if (hit) return hit;
  const out: Vec[] = [];
  for (const c of o.right) {
    for (let i = 0; i <= perSegment; i++) out.push(cubicAt(c.p0, c.p1, c.p2, c.p3, i / perSegment));
  }
  byRes.set(perSegment, out);
  return out;
}

/**
 * Demi-largeur du crâne à la hauteur y (interpolation sur les échantillons ; 0 hors de [-H/2, bottomY]).
 * Recherche DICHOTOMIQUE du premier intervalle qui contient y (les échantillons sont monotones en y) : même résultat que le balayage linéaire d'avant
 * (premier intervalle trouvé), en O(log n) au lieu de O(n).
 */
export function halfWidthAt(o: Outline, y: number, samples: readonly Vec[] = rightSamples(o)): number {
  if (y < -o.H / 2 || y > o.bottomY) return 0;
  let lo = 1;
  let hi = samples.length - 1;
  if (hi < 1) return 0;
  // Plus petit i ≥ 1 tel que samples[i].y ≥ y.
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((samples[mid] as Vec).y >= y) hi = mid;
    else lo = mid + 1;
  }
  const a = samples[lo - 1] as Vec;
  const b = samples[lo] as Vec;
  if (!((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y))) return 0;
  const dy = b.y - a.y;
  return Math.abs(dy) < 1e-9 ? Math.max(a.x, b.x) : a.x + ((b.x - a.x) * (y - a.y)) / dy;
}

/** Plus petite demi-largeur sur [y0, y1] : la contrainte réelle pour un objet qui occupe cet intervalle. */
export function minHalfWidth(o: Outline, y0: number, y1: number, steps = 24): number {
  const samples = rightSamples(o);
  let m = Infinity;
  for (let i = 0; i <= steps; i++) m = Math.min(m, halfWidthAt(o, y0 + ((y1 - y0) * i) / steps, samples));
  return m;
}
