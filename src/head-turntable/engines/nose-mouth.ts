import type { Poly } from '../../face/poly';
import type { BumpKnots } from '../types';
import type { EngineHead } from './face-model';
import { frontChain, skinPoints, zAt } from './profile';
import { fx, fy, py } from './units';

/** Demi-largeur (U) d'un polygone de l'hôte à la hauteur y (U) : x maximal des intersections avec l'horizontale. */
export function halfWidthOfPoly(poly: Poly, yU: number): number {
  const y = py(yU); let m = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    if ((a.y <= y && y <= b.y) || (b.y <= y && y <= a.y)) { const d = b.y - a.y, x = d === 0 ? Math.max(a.x, b.x) : a.x + (b.x - a.x) * ((y - a.y) / d); m = Math.max(m, Math.abs(x)); }
  }
  return fx(m);
}

const knots = (e: EngineHead, y0: number, y1: number, n: number, halfW: (y: number) => number): BumpKnots => {
  const front = frontChain(e);
  return Array.from({ length: n }, (_, i): readonly [number, number, number] => { const y = y0 + ((y1 - y0) * i) / (n - 1); return [y, zAt(front, y) ?? 0, Math.max(0.004, halfW(y))]; });
};

/** Profil du nez (y, z avant, demi-largeur) : z = profil de peau du moteur de crâne ; largeur = silhouette de la pyramide nasale du moteur de nez (parois + ailes). */
export function noseKnots(e: EngineHead): BumpKnots {
  const P = skinPoints(e), y0 = P.get('nasion')!.y, y1 = P.get('subnasale')!.y + 0.008;
  return knots(e, y0, y1, 14, (y) => halfWidthOfPoly(e.nose.silhouette, y));
}

/** Profil des lèvres : z = profil de peau (vermillon sup. → sillon mentolabial) ; largeur = polygones des lèvres du moteur de bouche. */
export function mouthKnots(e: EngineHead): BumpKnots {
  const P = skinPoints(e), y0 = P.get('vermilionSup')!.y - 0.004, y1 = P.get('sublabiale')!.y;
  const w = (y: number): number => Math.max(halfWidthOfPoly(e.mouth.upperLip, y), halfWidthOfPoly(e.mouth.lowerLip, y));
  return knots(e, y0, y1, 12, (y) => w(y));
}

/** Repères d'alae et de narines (U), lus sur `noseGeometry`. */
export function noseLandmarks(e: EngineHead): { crestX: number; crestY: number; baseY: number; rootY: number; tipY: number; nostrilX: number; nostrilY: number } {
  const a = e.nose.alae.right;
  return { crestX: fx(a.crest.x), crestY: fy(a.crest.y), baseY: fy(e.nose.baseY), rootY: fy(e.nose.root.y), tipY: fy(e.nose.tip.c.y), nostrilX: fx(e.nose.nostrils.right.c.x), nostrilY: fy(e.nose.nostrils.right.c.y) };
}
