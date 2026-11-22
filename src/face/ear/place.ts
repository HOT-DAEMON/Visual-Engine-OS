import { clamp } from '../../core/math';
import { Resolver, type Correction } from '../../core/resolve';
import type { FaceParams } from '../../schema';
import type { Vec } from '../../geometry/eye/primitives';
import { lerp } from '../curve';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt } from '../outline';
import type { EarPlacement } from './project';
import type { EarModel } from './types';

/** Ce que l'attache a mesuré : écarts d'alignement (px) aux repères du visage et corrections appliquées. */
export interface EarAlignment {
  /** Écart (px) entre la racine de l'hélix (fosse triangulaire) et la ligne des yeux ; 0 si l'ancrage « yeux » vaut 1. */
  readonly crusToEyeLine: number;
  /** Écart (px) entre le bas du lobule et la ligne visée (`anchors.lobuleLine` : base du nez par défaut) ; 0 si l'ancrage vaut 1 et que la famille a un lobule. */
  readonly lobuleToLine: number;
  /** Ordonnée (px) de la ligne visée par le lobule. */
  readonly lobuleLineY: number;
  readonly corrections: readonly Correction[];
}

/**
 * ATTACHE AU CRÂNE ET ALIGNEMENT SUR LE VISAGE (§6.1) : la position de l'oreille est DÉRIVÉE des repères stables du visage, jamais placée à la main.
 *   - la racine de l'hélix (au niveau de la fosse triangulaire) est posée sur la ligne des yeux (`anchors.eye`) ;
 *   - le bas du lobule est posé sur la BASE DU NEZ (sous-nasal) : en anatomie réelle l'oreille s'étend du sourcil à la base du nez. L'ancienne consigne (ligne de
 *     la bouche) donnait des oreilles de ≈ 0,41 H : erreur de cahier des charges, corrigée ; `anchors.lobuleLine = 'mouth'` la conserve pour comparaison ;
 *   - la hauteur en découle : h = (ligne du lobule − yeux) / (1 − niveau de la racine) ; sans lobule (félin, équidé…) ou à ancrage libre : h = 0,30 H × échelle.
 * Les ancrages se MÉLANGENT (0 = libre, 1 = exact). La hauteur reste dans [0,20 H ; 0,50 H] (contrainte stricte enregistrée, jamais silencieuse).
 */
/** Part de la pente du contour de la tête suivie par la surface d'accrochage (1 = tout le contour, 0 = verticale). */
export const EAR_LEAN = 0.5;
/** Largeur frontale minimale lisible (en hauteurs d'oreille) et angle d'écartement minimal du canon (°). */
export const FRONT_MIN = 0.26;
export const CANON_MIN_DEG = 21;

export function earPlacement(p: FaceParams, lm: FaceLandmarks, m: EarModel): { pl: EarPlacement; align: EarAlignment } {
  const e = p.ears;
  const R = new Resolver();
  const yCrus = (m.landmarks.crus as Vec).y;
  const mouthW = e.anchors.mouth * (m.resolved.present.lobule ? 1 : 0);
  const lineY = e.anchors.lobuleLine === 'mouth' ? lm.mouthY : lm.noseBaseY;
  // `attach.scale` : échelle relative. Elle agrandit l'oreille À PARTIR de la racine de l'hélix (qui reste sur la ligne des yeux) : le lobule s'éloigne de la base du nez (oreilles grandes) ou la remonte (petites).
  const hAligned = ((lineY - lm.eyeY) / (1 - yCrus)) * e.attach.scale;
  const hFree = 0.3 * lm.H * e.attach.scale;
  const hPx = R.limit('ear-height-range', 'ears.height', lerp(hFree, hAligned, mouthW), 0.2 * lm.H, 0.5 * lm.H, 'la hauteur de l’oreille reste entre 0,20 H et 0,50 H');
  const topAligned = lm.eyeY - yCrus * hPx;
  const topFree = (lm.eyeY + lm.noseBaseY) / 2 - hPx / 2;
  const topY = lerp(topFree, topAligned, e.anchors.eye);
  const yMax = lm.outline.bottomY - 0.02 * lm.H;
  const sink = e.attach.insertion * 0.04 * hPx;
  // Surface d'accrochage : le contour de la tête RENTRE vite sous l'oreille (mâchoire), alors que le plan du pavillon est quasi vertical (la racine de l'hélix suit l'os temporal, pas la mâchoire).
  // On n'en suit donc que la moitié de la pente (`EAR_LEAN`) : l'oreille ne s'incline plus en « trait » oblique ; l'écart qui s'ouvre vers le lobule est comblé par la jupe de racine (`project.ts`).
  const yA = topY, yB = topY + hPx;
  const hwA = halfWidthAt(lm.outline, clamp(yA, -lm.H / 2 + 0.02 * lm.H, yMax)), hwB = halfWidthAt(lm.outline, clamp(yB, -lm.H / 2 + 0.02 * lm.H, yMax));
  // Pente suivie : au moins `EAR_LEAN`, davantage si la mâchoire fuit fort (l'écart du lobule à la joue reste ≤ 15 % de la hauteur d'oreille).
  const drop = hwA - hwB;
  const lean = drop > 0 ? clamp(1 - (0.15 * hPx) / drop, EAR_LEAN, 1) : EAR_LEAN;
  const skullX = (y: number): number => {
    const yy = clamp(y, -lm.H / 2 + 0.02 * lm.H, yMax);
    const t = clamp((yy - yA) / (yB - yA || 1), 0, 1);
    return Math.max(0, hwA + (hwB - hwA) * t * lean - sink);
  };
  // LISIBILITÉ FRONTALE : de face, la largeur visible du pavillon ≈ L·sin α + épaisseur·cos α (en hauteurs d'oreille). Sous ≈ 0,26 H l'oreille n'est plus qu'un trait (cas réel : angle d'écartement
  // 16–17° sur un pavillon étroit) ; l'anatomie donne 21°–38° (écart auriculo-céphalique). Plancher PRÉFÉRENTIEL : l'exagération artistique l'assouplit, la correction est journalisée.
  const T = m.thickness * (m.structures.find((x) => x.id === 'helix')?.relief ?? 0.9);
  const target = FRONT_MIN * (1 - 0.6 * p.ears.style.exaggeration);
  const aMin = (Math.asin(clamp((target - T * 0.5) / Math.max(0.2, m.widthRatio), 0, 0.99)) * 180) / Math.PI;
  const opening = R.limit('ear-frontal-readable', 'ears.attach.openingDeg', e.attach.openingDeg, Math.max(CANON_MIN_DEG * (1 - 0.5 * p.ears.style.exaggeration), aMin), 60, 'de face, l’oreille ne doit pas se réduire à un trait : angle d’écartement relevé (canon 21°–38°)');
  const pl: EarPlacement = { side: m.side, hPx, topY, skullX, openingDeg: opening, pitchDeg: e.attach.pitchDeg, rotationDeg: e.attach.rotationDeg, pivotV: yCrus, headX: (y: number): number => halfWidthAt(lm.outline, clamp(y, -lm.H / 2 + 0.02 * lm.H, yMax)) };
  const lobeY = topY + (m.landmarks.lobuleBottom as Vec).y * hPx;
  return { pl, align: { crusToEyeLine: topY + yCrus * hPx - lm.eyeY, lobuleToLine: lobeY - lineY, lobuleLineY: lineY, corrections: R.applied } };
}
