import { clamp } from '../core/math';
import { halfWidthAt, headOutline, type Outline } from './outline';
import type { FaceAsymmetry, FaceParams } from '../schema';
import type { Vec } from '../geometry/eye/primitives';

/** Géométrie de la bouche (px) : lue par le rendu de la bouche, de la moustache et de la barbe. */
export interface LipLandmarks {
  readonly half: number;
  readonly cornerY: number;
  readonly upperH: number;
  readonly lowerH: number;
  readonly openH: number;
  /** Haut de la lèvre supérieure (creux de l'arc de Cupidon) et bas de la lèvre inférieure (bouche ouverte comprise). */
  readonly topY: number;
  readonly bottomY: number;
}

/** Cou : demi-largeur bornée entre le menton et la mâchoire, du haut (caché derrière la tête) jusqu'en bas. */
export interface NeckLandmarks {
  readonly half: number;
  readonly topY: number;
  readonly bottomY: number;
}

/** Naissance des cheveux (toujours au-dessus de `browLimitY`) : hauteur au centre, au point de tempe, ancrage du dôme. */
export interface HairLandmarks {
  readonly centerY: number;
  readonly templeY: number;
  readonly sideY: number;
}

/**
 * Repères anatomiques d'un visage, en pixels dans le repère local de l'hôte (origine au centre).
 * SOURCE UNIQUE de vérité : le rendu du nez/de la bouche/des cheveux/de la barbe et le placement des
 * yeux lisent ces mêmes valeurs, donc un enfant ne peut pas « dériver » par rapport au visage qui le porte.
 */
export interface FaceLandmarks {
  readonly W: number;
  readonly H: number;
  readonly outline: Outline;
  /** Ordonnée MOYENNE de la ligne des yeux (les deux canthi s'en écartent de ±eyeDy/2 si asymétrie). */
  readonly eyeY: number;
  /** Canthus interne de l'œil de gauche de l'IMAGE (x < 0) et de droite (x > 0). */
  readonly innerCanthus: { readonly left: Vec; readonly right: Vec };
  readonly noseBaseY: number;
  readonly noseTipY: number;
  readonly mouthY: number;
  readonly chinY: number;
  /** Ordonnée du coin de mâchoire. */
  readonly jawY: number;
  /** Limites verticales (ordonnées) de la zone des yeux : au-dessus, le front nu ; au-dessous, le nez. */
  readonly browLimitY: number;
  readonly lowerLimitY: number;
  readonly lips: LipLandmarks;
  readonly neck: NeckLandmarks;
  readonly hair: HairLandmarks;
  readonly asymmetry: FaceAsymmetry;
}

/** Marge entre la bouche et la base du nez (fraction de H) : la bouche ne remonte jamais sous le nez. */
const NOSE_MOUTH_GAP = 0.07;

export function faceLandmarks(p: FaceParams, W: number, H: number): FaceLandmarks {
  const eyeY = -H / 2 + p.eyeLine * H;
  const half = (p.eyeGap * W) / 2;
  const dy = (p.asymmetry.eyeDy * H) / 2;
  const noseBaseY = eyeY + p.nose.length * H;
  const outline = headOutline(p, W, H);
  const mouthY = Math.max(-H / 2 + p.mouth.y * H, noseBaseY + NOSE_MOUTH_GAP * H);
  const m = p.mouth;
  const upperH = (0.012 + 0.03 * m.upperLip) * H;
  const lowerH = (0.02 + 0.05 * m.lowerLip) * H;
  const openH = m.open * 0.09 * H;
  const jawY = -H / 2 + p.jawY * H;
  const jawHalf = halfWidthAt(outline, jawY);
  // Le sourcil reste sous la zone de cheveux (au moins le haut du crâne, ou 0,2 H au-dessus de la ligne des
  // yeux : un front proportionné quelle que soit la hauteur des yeux) ; l'œil reste au-dessus du nez.
  const browLimitY = Math.max(-H / 2 + 0.12 * H, eyeY - 0.2 * H);
  const zone = browLimitY + H / 2;
  const hl = p.hair.hairline;
  const templeY = -H / 2 + (0.8 + 0.12 * hl) * zone;
  return {
    W,
    H,
    outline,
    eyeY,
    innerCanthus: { left: { x: -half, y: eyeY - dy }, right: { x: half, y: eyeY + dy } },
    noseBaseY,
    noseTipY: noseBaseY - 0.012 * H,
    mouthY,
    chinY: H / 2,
    jawY,
    browLimitY,
    lowerLimitY: eyeY + 0.5 * p.nose.length * H + 0.04 * H,
    lips: { half: (m.width * W) / 2, cornerY: mouthY - m.curve * 0.03 * H, upperH, lowerH, openH, topY: mouthY - upperH * 0.6, bottomY: mouthY + openH + lowerH },
    neck: { half: clamp((p.neck.width * W) / 2, outline.chinHalf * 1.15, jawHalf * 0.85), topY: -H / 2 + 0.6 * H, bottomY: H / 2 + p.neck.length * H },
    hair: { centerY: -H / 2 + (0.25 + 0.25 * hl) * zone, templeY, sideY: Math.max(-H / 2 + 0.08 * H, templeY - 0.05 * H) },
    asymmetry: p.asymmetry,
  };
}
