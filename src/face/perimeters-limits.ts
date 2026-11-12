import type { PerimeterId } from './perimeters';

/**
 * BORNES DES PÉRIMÈTRES D'OCCUPATION (source unique : lue par `face/fit-eye.ts`, `verify/perimeters.ts`, les artefacts et la doc `docs/FACE-PERIMETERS.md`).
 * Calibrées sur 200 visages `structured` tirés (`scripts/artefacts-face-perimeters.ts` rejoue la mesure) : chaque borne encadre la plage observée en la resserrant sur les cas aberrants
 * (sourcil qui CHEVAUCHE la paupière ou FLOTTE loin au-dessus). Les rapports de largeur suivent les canons (largeur du nez ≈ distance intercanthale, bouche ≈ 1,5 × cette distance).
 * `height` en fraction de H, `width` en fraction de la largeur du visage à la hauteur médiane du périmètre.
 */
export interface Range { readonly min: number; readonly max: number }
export const PERIMETER_LIMITS: Readonly<Record<PerimeterId, { readonly height: Range; readonly width: Range }>> = {
  forehead: { height: { min: 0.09, max: 0.38 }, width: { min: 0.5, max: 0.85 } },
  brows: { height: { min: 0.015, max: 0.1 }, width: { min: 0.3, max: 0.9 } },
  /** Distance sourcil / enveloppe palpébrale : FLEXIBLE (l'expression la lève ou la baisse) mais jamais nulle (sourcil sur la paupière) ni flottante. */
  browGap: { height: { min: 0.008, max: 0.06 }, width: { min: 0.3, max: 0.9 } },
  eyes: { height: { min: 0.05, max: 0.23 }, width: { min: 0.45, max: 0.9 } },
  interocular: { height: { min: 0.05, max: 0.3 }, width: { min: 0.12, max: 0.36 } },
  nose: { height: { min: 0.08, max: 0.2 }, width: { min: 0.09, max: 0.34 } },
  philtrum: { height: { min: 0.06, max: 0.115 }, width: { min: 0.04, max: 0.16 } },
  mouth: { height: { min: 0.035, max: 0.16 }, width: { min: 0.22, max: 0.7 } },
  chin: { height: { min: 0.07, max: 0.26 }, width: { min: 0.3, max: 1.05 } },
};

/** Rapports entre composants (canons) : demi-largeur de l'un / demi-largeur de l'autre. */
export const PERIMETER_RATIOS = {
  /** Distance intercanthale / largeur d'une fente (canon : 1, « règle des cinq yeux »). */
  interocularToEye: { min: 0.4, max: 2.1 },
  /** Largeur du nez (ailes) / distance intercanthale (canon : ≈ 1). */
  noseToInterocular: { min: 0.3, max: 1.6 },
  /** Largeur de la bouche / distance intercanthale (canon : ≈ 1,5). */
  mouthToInterocular: { min: 0.7, max: 2.8 },
  /** Largeur du menton / largeur de la bouche (canon : ≈ 1 ; < 0,5 : menton en pointe de bouclier). */
  chinToMouth: { min: 0.5, max: 2.1 },
} as const;

/** Écart sourcil / enveloppe palpébrale, en fraction de H : bornes de la contrainte posée par l'ajustement des yeux (`fitEyeToFace` option `perimeters`). */
export const BROW_GAP = PERIMETER_LIMITS.browGap.height;
