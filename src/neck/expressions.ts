import { clamp01 } from '../core/math';
import type { NeckSystem } from '../schema/neck-system';

/**
 * BODY LANGUAGE (TODO §5) : conventions EXPRESSIVES que l'artiste peut modifier — pas des vérités psychologiques. Chaque expression est un jeu de
 * DÉCALAGES appliqués à la pose de tête (jamais un état fixe) et mis à l'échelle par `bodyLanguageAmount`, de sorte qu'une même « colère »
 * n'impose pas la même inclinaison à tous les personnages. `shoulderRaise` (0–1) est publié pour le corps : le contrôleur de langage corporel
 * coordonne cou, épaules et regard ; le BRANCHEMENT du corps sur cette valeur n'est pas fait (docs/NECK-REMAINING.md).
 */
export interface PoseDelta {
  readonly pitchDeg: number; readonly rollDeg: number; readonly yawDeg: number;
  /** Translation avant (+) / arrière (−) de la tête, fraction de la demi-largeur du cou. */
  readonly translate: number;
  readonly compression: number; readonly stretch: number;
  /** Tension musculaire visible (0–1). */
  readonly tension: number;
  readonly shoulderRaise: number;
  /** Décalage du regard vers le haut (+) ou le bas (−), fraction de la hauteur de l'œil. */
  readonly gazeLift: number;
}
const Z: PoseDelta = { pitchDeg: 0, rollDeg: 0, yawDeg: 0, translate: 0, compression: 0, stretch: 0, tension: 0, shoulderRaise: 0, gazeLift: 0 };
type Expression = NeckSystem['pose']['bodyLanguage'];

export const BODY_LANGUAGE: Readonly<Record<Expression, PoseDelta>> = {
  neutral: Z,
  fear: { ...Z, compression: 0.5, translate: -0.2, tension: 0.4, shoulderRaise: 0.55, pitchDeg: -3, gazeLift: 0.2 },
  pride: { ...Z, stretch: 0.45, pitchDeg: -8, tension: 0.1, gazeLift: 0.3 },
  shame: { ...Z, pitchDeg: 18, compression: 0.3, shoulderRaise: 0.6, gazeLift: -0.5 },
  defiance: { ...Z, stretch: 0.2, translate: 0.3, rollDeg: 6, pitchDeg: -3, tension: 0.5 },
  fatigue: { ...Z, pitchDeg: 14, rollDeg: 8, compression: 0.2, tension: -0.1, gazeLift: -0.3 },
  curiosity: { ...Z, rollDeg: 14, yawDeg: 12, translate: 0.15, gazeLift: 0.1 },
  anger: { ...Z, translate: 0.2, pitchDeg: 5, tension: 0.6, compression: 0.2, shoulderRaise: 0.2 },
  relaxed: { ...Z, rollDeg: 4, pitchDeg: 3, tension: -0.2 },
};

/** Décalage effectif d'une expression à l'intensité donnée (table optionnelle : l'artiste remplace les conventions). */
export function expressionDelta(sys: NeckSystem, table: Readonly<Record<Expression, PoseDelta>> = BODY_LANGUAGE): PoseDelta {
  const d = table[sys.pose.bodyLanguage], k = sys.pose.bodyLanguageAmount;
  return { pitchDeg: d.pitchDeg * k, rollDeg: d.rollDeg * k, yawDeg: d.yawDeg * k, translate: d.translate * k, compression: d.compression * k, stretch: d.stretch * k, tension: d.tension * k, shoulderRaise: clamp01(d.shoulderRaise * k), gazeLift: d.gazeLift * k };
}

/** Compression et étirement EFFECTIFS (pose + expression) : lus par `frame.ts`, donc par le corps (la base du cou monte quand la tête s'enfonce). */
export function effectiveAxial(sys: NeckSystem): { compression: number; stretch: number } {
  const d = expressionDelta(sys);
  return { compression: clamp01(sys.pose.compression + Math.max(0, d.compression) - Math.max(0, -d.compression)), stretch: clamp01(sys.pose.stretch + d.stretch) };
}
