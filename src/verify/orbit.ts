import { halfWidthAt, noseGeometry, rightSamples, type FaceLandmarks } from '../face';
import { inside, type PlacedEye } from '../anatomy/relations';
import { openingInHost, publishedOrbits, sideOf, type PublishedOrbits } from '../anatomy/orbit';
import { faceComponents } from '../render/face/components';
import type { FaceParams } from '../schema';
import { check, type Check } from './types';

/**
 * Vérification de l'ORBITE PUBLIÉE (docs/ORBIT-PUBLISH.md), sur la géométrie que le rendu consomme réellement :
 *  - géométrie : le polygone de l'ombre `orbitL/orbitR` du graphe de contact CONTIENT l'ouverture de chaque œil posé (le rendu lit bien l'orbite publiée) ;
 *  - anatomie : l'orbite reste dans le contour du crâne ; les deux orbites ne se chevauchent pas ; elle ne grossit que de façon bornée (≤ 1,3 en aire).
 */
export function verifyOrbits(id: string, params: FaceParams, lm: FaceLandmarks, eyes: readonly PlacedEye[], published: PublishedOrbits = publishedOrbits(lm, eyes)): Check[] {
  const out: Check[] = [];
  const comps = faceComponents(params, lm, noseGeometry(params, lm), published).components;
  const rs = rightSamples(lm.outline);
  for (const side of ['left', 'right'] as const) {
    const o = published[side];
    // Contenance : l'ouverture tient dans le POLYGONE d'ombre réellement émis (et non seulement dans l'ellipse théorique).
    const poly = comps.find((c) => c.id === (side === 'left' ? 'orbitL' : 'orbitR'))?.polys[0];
    const eyesOfSide = eyes.filter((e) => sideOf(e) === side);
    const missed = poly ? eyesOfSide.flatMap((e) => openingInHost(e)).filter((p) => !inside(p, poly)).length : -1;
    out.push(check('geometry', `orbit.shadow-contains-eye.${id}.${side}`, '==', missed, 0, "le polygone d'ombre de l'orbite ne contient pas toute l'ouverture de l'œil"));
    // Dans le crâne : 48 points de l'ellipse sous la demi-largeur du contour à leur hauteur.
    let over = -Infinity;
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * 2 * Math.PI;
      over = Math.max(over, Math.abs(o.cx + o.rx * Math.cos(t)) - halfWidthAt(lm.outline, o.cy + o.ry * Math.sin(t), rs));
    }
    out.push(check('anatomy', `orbit.inside-head.${id}.${side}`, '<=', over, 0, "l'orbite dépasse le contour du crâne"));
    const prior = lm.orbit[side];
    out.push(check('anatomy', `orbit.growth.${id}.${side}`, '<=', (o.rx * o.ry) / (prior.rx * prior.ry), 1.3, "l'orbite publiée a trop grossi par rapport à l'a priori", 'warn'));
  }
  out.push(check('anatomy', `orbit.apart.${id}`, '>=', published.right.cx - published.right.rx - (published.left.cx + published.left.rx), 0, 'les deux orbites se chevauchent sur la ligne médiane'));
  return out;
}
