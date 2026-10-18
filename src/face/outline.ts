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
  return { right: [seg1, ...low.segments], W, H, chinHalf: low.chinHalf, bottomY: low.bottom.y, keys: { gonion: low.gonion, chinCorner: low.chinCorner, bottom: low.bottom } };
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

/** Échantillons (x, y) de la moitié droite, y croissant. */
export function rightSamples(o: Outline, perSegment = 48): Vec[] {
  const out: Vec[] = [];
  for (const c of o.right) {
    for (let i = 0; i <= perSegment; i++) out.push(cubicAt(c.p0, c.p1, c.p2, c.p3, i / perSegment));
  }
  return out;
}

/** Demi-largeur du crâne à la hauteur y (interpolation sur les échantillons ; 0 hors de [-H/2, H/2]). */
export function halfWidthAt(o: Outline, y: number, samples: readonly Vec[] = rightSamples(o)): number {
  if (y < -o.H / 2 || y > o.bottomY) return 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] as Vec;
    const b = samples[i] as Vec;
    if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
      const dy = b.y - a.y;
      return Math.abs(dy) < 1e-9 ? Math.max(a.x, b.x) : a.x + ((b.x - a.x) * (y - a.y)) / dy;
    }
  }
  return 0;
}

/** Plus petite demi-largeur sur [y0, y1] : la contrainte réelle pour un objet qui occupe cet intervalle. */
export function minHalfWidth(o: Outline, y0: number, y1: number, steps = 24): number {
  const samples = rightSamples(o);
  let m = Infinity;
  for (let i = 0; i <= steps; i++) m = Math.min(m, halfWidthAt(o, y0 + ((y1 - y0) * i) / steps, samples));
  return m;
}
