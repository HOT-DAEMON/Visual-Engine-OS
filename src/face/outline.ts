import { cubicAt, norm, type Cubic, type Vec } from '../geometry/eye/primitives';
import { num } from '../core/svg';
import type { FaceParams } from '../schema';

/**
 * Contour du crâne + mâchoire (géométrie pure, sans SVG). Repère local de l'hôte : origine au centre,
 * x vers la droite, y vers le bas ; la boîte englobante est exactement [-W/2, W/2] × [-H/2, H/2].
 * Le contour est symétrique : on ne construit que la moitié DROITE (du sommet au menton), la gauche
 * en est le miroir. Trois cubiques raccordées en tangente : sommet → temple (le plus large),
 * temple → coin de mâchoire, coin de mâchoire → bord du menton (tangente horizontale).
 */
const KAPPA = 0.5523; // contrôle d'un quart d'ellipse par une cubique

export interface Outline {
  /** Moitié droite, du sommet (0, -H/2) au bord droit du menton (cx, H/2). */
  readonly right: readonly Cubic[];
  readonly W: number;
  readonly H: number;
  /** Demi-largeur du bas du menton (plat). */
  readonly chinHalf: number;
}

const along = (a: Vec, d: Vec, k: number): Vec => ({ x: a.x + d.x * k, y: a.y + d.y * k });
const dist = (a: Vec, b: Vec): number => Math.hypot(b.x - a.x, b.y - a.y);

export function headOutline(p: FaceParams, W: number, H: number): Outline {
  const top: Vec = { x: 0, y: -H / 2 };
  const temple: Vec = { x: W / 2, y: -H / 2 + p.templeY * H };
  const jaw: Vec = { x: (p.jawWidth * W) / 2, y: -H / 2 + p.jawY * H };
  const chin: Vec = { x: (p.chinWidth * W) / 2, y: H / 2 };

  const seg1: Cubic = {
    p0: top,
    p1: { x: KAPPA * temple.x, y: top.y },
    p2: { x: temple.x, y: temple.y - KAPPA * (temple.y - top.y) },
    p3: temple,
  };
  // Tangente commune au coin de mâchoire : direction du coin vers le bord du menton.
  const d = norm({ x: chin.x - jaw.x, y: chin.y - jaw.y });
  const seg2: Cubic = {
    p0: temple,
    p1: { x: temple.x, y: temple.y + 0.45 * (jaw.y - temple.y) },
    // Contrôle borné à x ≤ W/2 : sans cela le flanc pouvait dépasser la largeur déclarée du crâne.
    p2: (() => {
      const c = along(jaw, d, -0.4 * dist(temple, jaw));
      return { x: Math.min(c.x, temple.x), y: c.y };
    })(),
    p3: jaw,
  };
  const seg3: Cubic = {
    p0: jaw,
    p1: along(jaw, d, 0.4 * dist(jaw, chin)),
    p2: { x: chin.x + 0.35 * (jaw.x - chin.x), y: chin.y },
    p3: chin,
  };
  return { right: [seg1, seg2, seg3], W, H, chinHalf: chin.x };
}

const mirror = (v: Vec): Vec => ({ x: -v.x, y: v.y });

/** Chemin SVG fermé du contour complet (droite descendante, base du menton, gauche montante). */
export function outlinePath(o: Outline): string {
  const f = (v: Vec): string => `${num(v.x)} ${num(v.y)}`;
  const [s1, s2, s3] = o.right as [Cubic, Cubic, Cubic];
  const down = (c: Cubic): string => `C${f(c.p1)} ${f(c.p2)} ${f(c.p3)}`;
  const up = (c: Cubic): string => `C${f(mirror(c.p2))} ${f(mirror(c.p1))} ${f(mirror(c.p0))}`;
  return `M${f(s1.p0)}${down(s1)}${down(s2)}${down(s3)}L${f(mirror(s3.p3))}${up(s3)}${up(s2)}${up(s1)}Z`;
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
  if (y < -o.H / 2 || y > o.H / 2) return 0;
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
