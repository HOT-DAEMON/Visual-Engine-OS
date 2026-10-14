import type { EyeSpec } from '../schema';

/**
 * Recalcule la « pose » d'un œil neutre pour une émotion donnée. Fonction pure et déterministe :
 * mêmes entrées, même résultat, aucun hasard. Ne touche ni aux couleurs, ni à la géométrie de
 * l'iris/sclère/cils/canthi — uniquement l'ouverture, le pli, le sourcil, le regard et la pupille,
 * c'est-à-dire les paramètres qu'un visage change réellement pour exprimer une émotion.
 *
 * Chaque delta est défini pour intensity=1 puis mis à l'échelle linéairement. 'neutral' et
 * intensity=0 sont l'identité exacte (aucun champ modifié).
 */
export type ExpressionKind = NonNullable<EyeSpec['expression']>['kind'];

export interface Delta {
  readonly openness: number;
  readonly upperFraction: number;
  readonly tiltDeg: number;
  readonly creaseDepthAdd: number;
  readonly browGap: number;
  readonly browTiltDeg: number;
  readonly browArch: number;
  readonly browPinch: number;
  readonly pitchDeg: number;
  readonly pupilSize: number;
}

export const ZERO: Delta = {
  openness: 0,
  upperFraction: 0,
  tiltDeg: 0,
  creaseDepthAdd: 0,
  browGap: 0,
  browTiltDeg: 0,
  browArch: 0,
  browPinch: 0,
  pitchDeg: 0,
  pupilSize: 0,
};
