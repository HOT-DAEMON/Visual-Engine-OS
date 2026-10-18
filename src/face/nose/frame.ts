import { clamp } from '../../core/math';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';

/**
 * Cadre du nez : les quelques grandeurs (px) dont dépendent TOUS les sous-composants, calculées une seule fois depuis `FaceParams`
 * et les repères du visage. Aucun sous-composant ne recalcule ces valeurs : c'est ce qui garantit qu'ils se raccordent.
 */
export interface NoseFrame {
  readonly W: number;
  readonly H: number;
  /** Largeur totale des ailes. */
  readonly nw: number;
  readonly baseY: number;
  readonly tipY: number;
  readonly rootY: number;
  /** Demi-écart inter-canthal (le nez naît entre les canthi internes). */
  readonly canthusHalf: number;
  readonly rootHalf: number;
  readonly dorsumHalf: number;
  readonly tipHalf: number;
  readonly tipRy: number;
  /** Abscisse du point le plus saillant d'une aile. */
  readonly alarX: number;
  readonly colHalf: number;
}

/** Hauteur de la pointe au-dessus de la base du nez (fraction de H) : 0,035 pointe neutre ; relevée → plus haut, abaissée → plus bas. */
export const tipLift = (rotation: number): number => 0.035 + 0.012 * rotation;

export function noseFrame(p: FaceParams, lm: FaceLandmarks): NoseFrame {
  const n = p.nose;
  const { W, H } = lm;
  const nw = n.width * W;
  const canthusHalf = Math.abs(lm.innerCanthus.right.x);
  // Racine : entre le niveau des canthi internes (0) et 0,09 H au-dessus (1), sans jamais passer sous la limite des sourcils.
  const rootY = Math.max(lm.browLimitY + 0.01 * H, lm.eyeY - (0.015 + 0.075 * n.root.height) * H);
  const tipHalf = nw * (0.12 + 0.1 * n.tip.width);
  return {
    W,
    H,
    nw,
    baseY: lm.noseBaseY,
    tipY: lm.noseBaseY - tipLift(n.tip.rotation) * H,
    rootY,
    canthusHalf,
    // La racine reste plus étroite que l'écart entre les canthi (≤ 85 %) : le nez ne mord pas sur les yeux.
    rootHalf: clamp(canthusHalf * (0.45 + 0.4 * n.root.width), 1, canthusHalf * 0.85),
    dorsumHalf: nw * (0.12 + 0.1 * n.dorsum.width),
    tipHalf,
    // Pointe pointue : plus haute que large ; bulbeuse : proche du cercle.
    tipRy: tipHalf * (1.25 - 0.35 * n.tip.roundness),
    alarX: (nw / 2) * (0.86 + 0.28 * n.alae.flare),
    colHalf: nw * (0.04 + 0.07 * n.nostrils.columella),
  };
}
