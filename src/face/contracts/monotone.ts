/**
 * INVARIANTS DE MONOTONIE : « si j'augmente ce paramètre, cette mesure ne diminue jamais » (et inversement), sur un balayage.
 * C'est l'observable qui détecte une zone MORTE (le paramètre n'a plus d'effet) ou un retournement. Une zone morte connue est déclarée
 * dans `deadAbove` / `deadBelow` avec sa raison : elle est tolérée, documentée, et le test échoue si elle disparaît sans mise à jour.
 */
export interface MonotoneRule {
  readonly param: string;
  readonly measure: string;
  readonly direction: 1 | -1;
  readonly sweep: readonly number[];
  readonly base?: Record<string, unknown>;
}

export const MONOTONE: readonly MonotoneRule[] = [
  { param: 'jawWidth', measure: 'mandible.outerHalf', direction: 1, sweep: [0.55, 0.65, 0.75, 0.85] },
  { param: 'chinWidth', measure: 'chin.widthPx', direction: 1, sweep: [0.34, 0.38, 0.42, 0.46] }, // au-dessus du plancher de continuité mandibule → menton (en dessous, la largeur est volontairement saturée)
  { param: 'nose.length', measure: 'nose.lengthPx', direction: 1, sweep: [0.17, 0.2, 0.23, 0.26] },
  { param: 'nose.width', measure: 'nose.widthPx', direction: 1, sweep: [0.1, 0.14, 0.18, 0.22] },
  { param: 'mouth.width', measure: 'mouth.halfWidthPx', direction: 1, sweep: [0.16, 0.2, 0.24] },
  { param: 'mouth.open', measure: 'mouth.openPx', direction: 1, sweep: [0, 0.3, 0.6, 1] },
  { param: 'eyeGap', measure: 'eye.gapPx', direction: 1, sweep: [0.2, 0.25, 0.3, 0.34] },
];
