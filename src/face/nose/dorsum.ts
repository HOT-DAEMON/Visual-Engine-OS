import { lerp, smooth } from '../curve';
import type { FaceParams } from '../../schema';
import type { NoseFrame } from './frame';
import type { NoseDorsumGeo, NoseRootGeo } from './types';

/** Nombre d'échantillons le long de l'arête (racine → supra-pointe). */
export const DORSUM_SAMPLES = 24;

/**
 * Racine et dorsum. L'arête naît à la racine (étroite, entre les orbites), s'affine sur le pont osseux, puis s'élargit vers la pointe.
 * Quatre profils (`straight`, `concave`, `convex`, `asymmetric`) : les trois premiers agissent sur le PROFIL (voir `profile.ts`),
 * `asymmetric` agit en plus sur la FACE (déviation latérale en S de l'axe). La paroi (`wallHalf`) est la silhouette de la pyramide nasale.
 */
export function dorsumGeometry(p: FaceParams, F: NoseFrame): { root: NoseRootGeo; dorsum: NoseDorsumGeo } {
  const n = p.nose;
  const supratipY = F.tipY - 0.6 * F.tipRy;
  // Déviation latérale : seulement pour un dorsum asymétrique ; amplitude bornée à 3 % de W (le nez reste dans sa pyramide).
  const dev = n.dorsum.shape === 'asymmetric' ? n.dorsum.deviation * 0.03 * F.W : 0;
  const axis: { x: number; y: number }[] = [];
  const half: number[] = [];
  const wallHalf: number[] = [];
  for (let i = 0; i < DORSUM_SAMPLES; i++) {
    const t = i / (DORSUM_SAMPLES - 1);
    axis.push({ x: dev * Math.sin(2 * Math.PI * t), y: lerp(F.rootY, supratipY, t) });
    // Arête : la racine (large) se resserre vers le pont (`dorsumHalf`) sur la première moitié, puis s'évase jusqu'à la largeur de la pointe.
    half.push(lerp(lerp(F.rootHalf, F.dorsumHalf, smooth(t / 0.55)), F.tipHalf * 1.05, smooth((t - 0.55) / 0.45)));
    // Paroi : effilée à la racine (0,35 × sa demi-largeur : la pyramide naît dans le front sans coupe franche) vers 0,3 de la largeur des ailes au niveau de la supra-pointe.
    wallHalf.push(lerp(F.rootHalf * 0.35, F.nw * 0.3, smooth(t ** 1.1)));
  }
  return {
    root: { y: F.rootY, half: F.rootHalf, depthPx: (F.baseY - F.rootY) * (0.04 + 0.2 * n.root.depth) },
    dorsum: { axis, half, wallHalf, deviationPx: dev },
  };
}
