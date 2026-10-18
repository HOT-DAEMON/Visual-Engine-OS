import type { FaceParams } from '../../schema';

/**
 * Grandeurs DÉRIVÉES du menton et de la mâchoire : tout ce que le contour, les repères et le rendu ont besoin de savoir,
 * calculé UNE FOIS depuis `FaceParams` (jamais recalculé à deux endroits avec deux formules). Unités : px pour `W`/`H` donnés.
 */
export interface JawDerived {
  /** Abaissement de la mandibule dû à l'ouverture de la bouche (px, ≥ 0). */
  readonly drop: number;
  /** Angle mandibulaire en degrés (95 anguleux … 140 très obtus). */
  readonly gonialDeg: number;
  /** Rayon d'arrondi du coin de mâchoire (px). */
  readonly cornerRadius: number;
  /** Déformation des tissus (toutes 0 si la bouche est fermée ou `tissue = 0`). */
  readonly tissue: {
    /** Étirement de la lèvre inférieure : 0…~0,3 (la lèvre s'amincit de cette part). */
    readonly lipStretch: number;
    /** Aplatissement du sillon mentolabial : 0 = intact, 1 = effacé. */
    readonly sulcusFlatten: number;
    /** Creusement supplémentaire des plis naso-géniens (multiplicateur - 1). */
    readonly nasolabialDeepen: number;
    /** Remontée des pommettes (px) : les joues se compriment vers le haut. */
    readonly cheekLift: number;
    /** Tension sous-mentonnière : agrandit l'ombre sous la mâchoire (0…1). */
    readonly submentalTension: number;
  };
}

/** Hauteur d'ouverture de la bouche (px) : source unique, partagée avec `faceLandmarks` (`lips.openH`). */
export const mouthOpenPx = (p: FaceParams, H: number): number => p.mouth.open * 0.09 * H;

export function jawDerived(p: FaceParams, W: number, H: number): JawDerived {
  const j = p.jaw;
  const open = p.mouth.open;
  // La mandibule descend d'une part de l'ouverture de la bouche, proportionnelle à la mobilité, bornée à 8 % de H :
  // une mobilité nulle laisse le menton en place (mâchoire rigide), une mobilité forte l'abaisse.
  const drop = Math.min(0.08 * H, mouthOpenPx(p, H) * 1.1 * j.mobility);
  const s = j.tissue * open;
  return {
    drop,
    gonialDeg: 95 + 45 * j.angle,
    cornerRadius: (0.012 + 0.11 * j.angle) * W,
    tissue: {
      lipStretch: 0.3 * s,
      sulcusFlatten: Math.min(1, 0.8 * s),
      nasolabialDeepen: 0.6 * s,
      cheekLift: 0.012 * H * s,
      submentalTension: Math.min(1, 0.5 * (drop / (0.08 * H)) + 0.5 * j.submental),
    },
  };
}

/** Écart minimal nez → bouche (fraction de H) : source unique, partagée avec `faceLandmarks`. */
export const NOSE_MOUTH_GAP = 0.07;

/**
 * Ordonnée (px) du bas de la lèvre inférieure, ESTIMÉE depuis les seuls paramètres (sans contour : le contour en a besoin pour placer le coin du
 * menton, et les repères ont besoin du contour). Même formule que `faceLandmarks` (`lips.bottomY`), à l'étirement des tissus près.
 * Le coin du menton ne remonte jamais au-dessus : la bouche repose sur le corps de la mandibule, pas sur l'arrondi étroit du menton.
 */
export function mouthFloorY(p: FaceParams, H: number): number {
  const noseBase = -H / 2 + p.eyeLine * H + p.nose.length * H;
  const mouthY = Math.max(-H / 2 + p.mouth.y * H, noseBase + NOSE_MOUTH_GAP * H);
  return mouthY + mouthOpenPx(p, H) + (0.02 + 0.05 * p.mouth.lowerLip) * H;
}
