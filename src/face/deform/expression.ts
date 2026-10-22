import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';

/**
 * DÉFORMATION EXPRESSIVE (C, T12) : les huit axes `deform.expression` sont traduits en PULSIONS de tissu (déplacements en px, jamais en formes absolues).
 * Une pulsion s'ajoute à la morphologie (A) et à l'articulation (B) sans les réécrire : c'est ce qui permet à une mâchoire massive de sourire sans changer de mâchoire
 * (les pulsions ne touchent que lèvres, joues, plis ; le contour osseux, lui, n'est jamais déplacé par l'expression — vérifié par test).
 * Chaque coefficient est un déplacement maximal plausible à intensité 1, en fraction de W ou de H ; `gain` = 1 + 1,5 × caricature multiplie le tout.
 */
export interface ExpressionPulls {
  /** Remontée des commissures (px, + = vers le haut). */
  readonly cornerLift: number;
  /** Écartement latéral des commissures (px, + = vers l'extérieur). */
  readonly cornerOut: number;
  /** Remontée des joues sous l'œil (px) : la chair se compresse vers le haut (bombement). */
  readonly cheekRaise: number;
  /** Retroussement de la lèvre supérieure (px, + = vers le haut). */
  readonly upperLipRaise: number;
  /** Abaissement de la lèvre inférieure (px, + = vers le bas) par les dépresseurs, en plus de la mandibule. */
  readonly lowerLipDepress: number;
  /** Dilatation des ailes du nez (fraction de leur largeur). */
  readonly noseFlare: number;
  /** Creusement supplémentaire des plis (multiplicateur − 1) : nasogénien et péri-buccaux. */
  readonly foldDeepen: number;
  /** Tension des lèvres (0–1) : lèvres plus fines, ligne plus rectiligne. */
  readonly lipTension: number;
  /** Dents découvertes (0–1). */
  readonly teethBare: number;
  /** Fronce du menton (muscle mentonnier) : 0–1, peau du menton qui se plisse en « peau d'orange ». */
  readonly chinBoss: number;
  /** Gain global appliqué (caricature). */
  readonly gain: number;
}

const pos = (v: number): number => Math.max(0, v);

export function resolveExpression(p: FaceParams, lm: FaceLandmarks): ExpressionPulls {
  const e = p.deform.expression;
  const { W, H } = lm;
  const gain = 1 + 1.5 * e.caricature;
  const smile = e.smile;
  const { surprise, disgust, disdain, ooh } = e;
  // Sourire (zygomatique) : commissures vers le haut (2,2 % de H) et l'extérieur (2 % de W), joues qui remontent (1,4 % de H). Moue : commissures vers le bas, fronce du menton.
  // Grimace (risorius) : commissures tirées vers l'extérieur (3,5 % de W), un peu vers le bas, lèvres tendues. Colère : lèvre supérieure retroussée, ailes dilatées, plis creusés.
  // Surprise, dégoût, dédain, « o » : mêmes pulsions, autres coefficients (pas de nouveau mécanisme : le contrat de somme reste le même).
  return {
    cornerLift: gain * (0.022 * H * smile - 0.004 * H * e.grimace - 0.01 * H * e.anger - 0.006 * H * disgust - 0.008 * H * disdain),
    cornerOut: gain * (0.02 * W * pos(smile) - 0.004 * W * pos(-smile) + 0.035 * W * e.grimace - 0.03 * W * ooh - 0.004 * W * surprise),
    cheekRaise: gain * (0.014 * H * pos(smile) * (0.5 + p.cheek.elasticity) + 0.006 * H * e.grimace + 0.005 * H * disgust),
    upperLipRaise: gain * (0.006 * H * pos(smile) + 0.01 * H * e.grimace + 0.014 * H * e.anger + 0.016 * H * disgust + 0.004 * H * surprise + 0.004 * H * ooh),
    lowerLipDepress: gain * (0.012 * H * e.grimace + 0.008 * H * e.anger + 0.014 * H * surprise + 0.006 * H * ooh),
    noseFlare: gain * (0.12 * e.anger + 0.08 * disgust + 0.05 * surprise),
    foldDeepen: gain * (0.5 * pos(smile) + 0.4 * e.grimace + 0.7 * e.anger + 0.6 * disgust + 0.3 * ooh),
    lipTension: Math.min(1, gain * (e.grimace + 0.4 * disdain + 0.2 * ooh)),
    teethBare: Math.min(1, gain * (0.5 * pos(smile) + e.grimace + 0.6 * e.anger + 0.3 * disgust)),
    chinBoss: Math.min(1, gain * (0.3 * pos(-smile) + 0.5 * e.anger + 0.3 * disgust + 0.5 * disdain)),
    gain,
  };
}
