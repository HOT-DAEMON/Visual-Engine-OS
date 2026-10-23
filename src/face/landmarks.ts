import { memoPure } from '../perf';
import { Resolver, type Correction } from '../core/resolve';
import { halfWidthAt, headOutline, minHalfWidth, type Outline } from './outline';
import { jawDerived, mouthOpenPx, NOSE_MOUTH_GAP, type JawDerived } from './jaw/params';
import { tipLift } from './nose/frame';
import { mouthCeilingY, noseLengthFrac, philtrumFloorY } from './zones-limits';
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

/** Menton : le sillon mentolabial et le bas, mesurés. `heightPx` peut être inférieur à `requestedPx` si la lèvre ouverte le contraint. */
export interface ChinLandmarks {
  /** Ordonnée du sillon mentolabial (sous la lèvre inférieure). */
  readonly sulcusY: number;
  /** Hauteur RÉELLE du menton (sillon → bas), px ; `requestedPx` = hauteur demandée (`chin.height × H`). */
  readonly heightPx: number;
  readonly requestedPx: number;
  /** Demi-largeur du menton au coin, et avancée simulée de la projection (px, sert aux ombres et aux reflets). */
  readonly half: number;
  readonly projectionPx: number;
}

/** Mâchoire : coin, angle, abaissement, déformations des tissus (voir `jaw/params.ts`). */
export interface JawLandmarks {
  readonly gonion: Vec;
  readonly gonialDeg: number;
  readonly drop: number;
  readonly tissue: JawDerived['tissue'];
}

/** Région orbitaire (ellipse approchée autour de l'œil, avant ajustement) : reçoit l'ombre de l'arcade et du nez. */
export interface OrbitLandmarks {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
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
  readonly chin: ChinLandmarks;
  readonly jaw: JawLandmarks;
  readonly orbit: { readonly left: OrbitLandmarks; readonly right: OrbitLandmarks };
  readonly neck: NeckLandmarks;
  readonly hair: HairLandmarks;
  readonly asymmetry: FaceAsymmetry;
  /** Contraintes entre composants qui ont ramené une valeur demandée (procédure : `core/resolve.ts`) ; vide si rien n'a été corrigé. */
  readonly corrections: readonly Correction[];
}

/** Marge entre la bouche et la base du nez (fraction de H) : la bouche ne remonte jamais sous le nez. */

function faceLandmarksRaw(p: FaceParams, W: number, H: number): FaceLandmarks {
  const eyeY = -H / 2 + p.eyeLine * H;
  const half = (p.eyeGap * W) / 2;
  const dy = (p.asymmetry.eyeDy * H) / 2;
  // Zone du nez : en `structured`, le nez ne remonte pas vers l'espace entre les yeux (`zones-limits.ts`).
  const noseBaseY = eyeY + noseLengthFrac(p) * H;
  const outline = headOutline(p, W, H);
  const R = new Resolver();
  // Bouche : jamais sous le nez (plancher) ; en `structured`, jamais si bas que le philtrum dépasse sa longueur maximale (plafond ; le plancher prime si les bornes se croisent).
  const mouthY = R.limit('mouth-philtrum-zone', 'mouth.y', R.limit('mouth-below-nose', 'mouth.y', -H / 2 + p.mouth.y * H, Math.max(noseBaseY + NOSE_MOUTH_GAP * H, philtrumFloorY(p, H, noseBaseY)), Infinity, 'la bouche ne remonte jamais sous le nez'), Math.max(noseBaseY + NOSE_MOUTH_GAP * H, philtrumFloorY(p, H, noseBaseY)), mouthCeilingY(p, H, noseBaseY), 'le philtrum (base du nez → lèvre) ne dépasse pas sa longueur maximale');
  const m = p.mouth;
  const jd = jawDerived(p, W, H);
  // Déformation des tissus à l'ouverture : la lèvre inférieure s'étire (s'amincit) et la commissure s'écarte un peu.
  const stretch = jd.tissue.lipStretch;
  const upperH = (0.012 + 0.03 * m.upperLip) * H;
  const lowerH = (0.02 + 0.05 * m.lowerLip) * H * (1 - stretch);
  const openH = mouthOpenPx(p, H);
  const jawY = -H / 2 + p.jawY * H;
  const jawHalf = halfWidthAt(outline, jawY);
  // La bouche est un enfant du visage : sa demi-largeur (étirée à l'ouverture) ne dépasse jamais 80 % de la demi-largeur du crâne à sa hauteur (la plus étroite des deux : centre et bas de la bouche),
  // quelle que soit la mâchoire (une mâchoire étroite et arrondie ne doit pas laisser les commissures toucher le contour).
  const lipsBottom = mouthY + openH + lowerH;
  // « à sa hauteur » = à la hauteur la plus basse de la bouche (commissure ou lèvre inférieure, + la marge de la barbe) : c'est là que le crâne est le plus étroit.
  const yLow = Math.min(outline.bottomY - 1e-3, Math.max(mouthY - m.curve * 0.03 * H, lipsBottom) + 0.012 * H);
  const lipsHalf = R.limit('mouth-inside-contour', 'mouth.width', ((m.width * W) / 2) * (1 + 0.15 * stretch), 0, 0.8 * Math.min(halfWidthAt(outline, mouthY), halfWidthAt(outline, yLow)), 'la bouche reste à 80 % de la demi-largeur du contour à sa hauteur');
  // Sillon mentolabial : la mandibule entraîne le coussinet du menton (abaissement) ; le sillon reste sous la lèvre inférieure et au-dessus du bas.
  const sulcusRaw = H / 2 - p.chin.height * H + jd.drop;
  const sulcusY = R.limit('chin-height-room', 'chin.height', sulcusRaw, lipsBottom + 0.014 * H, outline.bottomY - 0.04 * H, 'le sillon mentolabial reste sous la lèvre inférieure et au-dessus du bas du menton');
  // Région orbitaire : de la ligne médiane de l'œil au temple, comme l'ajustement des yeux (même marge).
  const outerReach = minHalfWidth(outline, eyeY - 0.06 * H, eyeY + 0.06 * H) - 0.045 * W;
  const orbitOf = (s: -1 | 1): OrbitLandmarks => ({ cx: s * (half + (outerReach - half) * 0.5), cy: eyeY - 0.006 * H, rx: Math.max(0.01, (outerReach - half) * 0.62), ry: 0.085 * H });
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
    // Pointe du nez : même formule que le moteur de nez (`nose/frame.ts`), jamais une copie divergente.
    noseTipY: noseBaseY - tipLift(p.nose.tip.rotation) * H,
    mouthY,
    chinY: outline.bottomY,
    jawY,
    browLimitY,
    lowerLimitY: eyeY + 0.5 * p.nose.length * H + 0.04 * H,
    lips: { half: lipsHalf, cornerY: mouthY - m.curve * 0.03 * H, upperH, lowerH, openH, topY: mouthY - upperH * 0.6, bottomY: lipsBottom },
    chin: { sulcusY, heightPx: outline.bottomY - sulcusY, requestedPx: p.chin.height * H, half: outline.chinHalf, projectionPx: p.chin.projection * 0.045 * W },
    jaw: { gonion: outline.keys.gonion, gonialDeg: jd.gonialDeg, drop: jd.drop, tissue: jd.tissue },
    orbit: { left: orbitOf(-1), right: orbitOf(1) },
    // Largeur du cou : paramètre propre (`neck.width`) ; le menton ne l'agrandit QUE si `neck.chinCoupling` > 0 (0 par défaut : menton et cou indépendants).
    neck: { half: R.limit('neck-between-chin-and-jaw', 'neck.width', (p.neck.width * W) / 2 + p.neck.chinCoupling * (p.chin.projection - 0.5) * 0.05 * W, outline.chinHalf * 1.15, jawHalf * 0.85, 'le cou reste plus large que le menton et plus étroit que la mâchoire'), topY: -H / 2 + 0.6 * H, bottomY: H / 2 + p.neck.length * H },
    hair: { centerY: -H / 2 + (0.25 + 0.25 * hl) * zone, templeY, sideY: Math.max(-H / 2 + 0.08 * H, templeY - 0.05 * H) },
    asymmetry: p.asymmetry,
    corrections: R.applied,
  };
}

/** Version mémoïsée par contenu (fonction pure : voir `src/perf/content-cache.ts`) ; temps compté dans l'étape `geometry`. */
export const faceLandmarks: (p: FaceParams, W: number, H: number) => FaceLandmarks = memoPure('faceLandmarks', 'geometry', faceLandmarksRaw, 512);
