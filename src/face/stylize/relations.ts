import type { FaceLandmarks } from '../landmarks';

/**
 * RELATIONS ESSENTIELLES entre composants (T13, J : « sans détruire les relations essentielles »). Chaque relation est une inégalité MESURÉE sur les repères :
 * la vérification (couche style) la contrôle sur le visage stylisé, quelle que soit l'exagération. Une relation qui échoue est un bug de la stylisation.
 * `margin` ≥ 0 = relation respectée.
 */
export interface Relation {
  readonly id: string;
  readonly margin: number;
  readonly message: string;
}

export function relationsOf(lm: FaceLandmarks): Relation[] {
  const r = (id: string, margin: number, message: string): Relation => ({ id, margin, message });
  return [
    r('chin-narrower-than-jaw', lm.jaw.gonion.x - lm.outline.chinHalf, 'le menton est plus large que la mâchoire'),
    r('neck-between-chin-and-jaw', Math.min(lm.neck.half - lm.outline.chinHalf, lm.jaw.gonion.x - lm.neck.half), 'le cou sort de l’intervalle menton–mâchoire'),
    r('mouth-inside-contour', 0.8 * (lm.W / 2) - lm.lips.half, 'la bouche touche le contour'),
    r('vertical-order', Math.min(lm.eyeY - lm.browLimitY, lm.noseBaseY - lm.eyeY, lm.mouthY - lm.noseBaseY, lm.chin.sulcusY - lm.lips.bottomY, lm.chinY - lm.chin.sulcusY), 'l’ordre vertical sourcils / yeux / nez / bouche / menton est brisé'),
    r('chin-below-lip', lm.chinY - lm.lips.bottomY, 'le menton est au-dessus de la lèvre inférieure'),
  ];
}
