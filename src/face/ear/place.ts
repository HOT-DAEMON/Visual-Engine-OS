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
export function earPlacement(p: FaceParams, lm: FaceLandmarks, m: EarModel): { pl: EarPlacement; align: EarAlignment } {
  const e = p.ears;
  const R = new Resolver();
  const yCrus = (m.landmarks.crus as Vec).y;
  const mouthW = e.anchors.mouth * (m.resolved.present.lobule ? 1 : 0);
  const lineY = e.anchors.lobuleLine === 'mouth' ? lm.mouthY : lm.noseBaseY;
  const hAligned = (lineY - lm.eyeY) / (1 - yCrus);
  const hFree = 0.3 * lm.H * e.attach.scale;
  const hPx = R.limit('ear-height-range', 'ears.height', lerp(hFree, hAligned, mouthW), 0.2 * lm.H, 0.5 * lm.H, 'la hauteur de l’oreille reste entre 0,20 H et 0,50 H');
  const topAligned = lm.eyeY - yCrus * hPx;
  const topFree = (lm.eyeY + lm.noseBaseY) / 2 - hPx / 2;
  const topY = lerp(topFree, topAligned, e.anchors.eye);
  const yMax = lm.outline.bottomY - 0.02 * lm.H;
  const sink = e.attach.insertion * 0.04 * hPx;
  const skullX = (y: number): number => Math.max(0, halfWidthAt(lm.outline, clamp(y, -lm.H / 2 + 0.02 * lm.H, yMax)) - sink);
  const pl: EarPlacement = { side: m.side, hPx, topY, skullX, openingDeg: e.attach.openingDeg, pitchDeg: e.attach.pitchDeg, rotationDeg: e.attach.rotationDeg, pivotV: yCrus };
  const lobeY = topY + (m.landmarks.lobuleBottom as Vec).y * hPx;
  return { pl, align: { crusToEyeLine: topY + yCrus * hPx - lm.eyeY, lobuleToLine: lobeY - lineY, lobuleLineY: lineY, corrections: R.applied } };
}
