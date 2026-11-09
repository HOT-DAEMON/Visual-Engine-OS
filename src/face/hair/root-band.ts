import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import { RIM_FROM } from './crown-fill';

/**
 * BANDE DE REPOUSSE (`docs/HAIR-FORM-ROOTS.md`) : une racine sombre (`rootColor`) sous des cheveux teints est de la repousse. Elle se voit où les cheveux
 * s'écartent du cuir chevelu : à la RAIE et le long de l'IMPLANTATION ; ailleurs, les longueurs teintes la recouvrent. Avant : la sous-couche entière (toute
 * l'épaisseur de la coque, bord compris) prenait la teinte de racine : sous un rose, un casque brun faisait la silhouette du dôme partout où les mèches laissaient un jour.
 *
 * Maintenant la sous-couche est de la couleur des cheveux (ombrée) et la repousse n'est qu'un trait flou le long de l'implantation et autour de la raie, de
 * profondeur `rootBandDepth` < `RIM_FROM` × épaisseur de la coque : la silhouette (le bord) n'est jamais de la couleur de racine. Source unique : rendu ET vérification.
 */

/** Profondeur de la bande : part de l'épaisseur de la coque, bornes absolues (fractions de W). */
export const ROOT_DEPTH = { share: 0.42, min: 0.010, max: 0.045 } as const;

/** Profondeur (px) de la repousse pour une coque d'épaisseur maximale `thick` (px) sur une tête de largeur `W`. Toujours < `RIM_FROM` × `thick`. */
export function rootBandDepth(thick: number, W: number): number {
  const d = Math.min(ROOT_DEPTH.max * W, Math.max(ROOT_DEPTH.min * W, ROOT_DEPTH.share * thick));
  return Math.min(d, 0.9 * RIM_FROM * thick);
}

export interface RootBand {
  /** Profondeur de la bande (px) au-dessus de l'implantation et de chaque côté de la raie. */
  readonly depth: number;
  /** Implantation (ligne le long de laquelle la repousse se voit). */
  readonly hairline: readonly Vec[];
  /** Raie nue (cuir chevelu visible), `null` sans raie visible. */
  readonly part: Poly | null;
}

/** Pas de bande (`null`) si la coque est trop mince pour porter une repousse distincte (coupe rase : 0,01 W) ou sans implantation. */
export function rootBand(hairline: readonly Vec[], part: Poly | null, thick: number, W: number): RootBand | null {
  if (thick < 0.012 * W || hairline.length < 2) return null;
  return { depth: rootBandDepth(thick, W), hairline, part };
}
