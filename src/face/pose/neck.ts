import { NECK_REF } from '../../neck/frame';
import type { FaceLandmarks } from '../landmarks';
import type { Skull } from './skull';

/**
 * COU COMPLET : cylindre elliptique (demi-axes a = largeur, b = profondeur) dont l'axe passe sous le crâne, légèrement en arrière
 * (la nuque est derrière le menton). Il suit la tête avec une FRACTION de la rotation (`TWIST`) : au-delà, la tête pivote sur le cou.
 * Silhouette projetée sous rotation : demi-largeur = √((a cos θ)² + (b sin θ)²) ; la pomme du cou / le menton se décalent avec la tête.
 */
/** Part de rotation suivie PAR DÉFAUT (valeur du moteur de cou : `NECK_REF.twistShare`) ; la valeur effective d'un visage est `lm.neck.twistShare`. */
export const TWIST = NECK_REF.twistShare;
export interface Neck {
  readonly a: number;
  readonly b: number;
  readonly topY: number;
  readonly bottomY: number;
  /** Décalage z de l'axe du cou (négatif = derrière le centre du crâne). */
  readonly zAxis: number;
  /** Part de rotation suivie (moteur de cou). */
  readonly twistShare: number;
  /** Rotation du cou pour une rotation de tête donnée (degrés). */
  yawOf(headYaw: number): number;
  /** Demi-largeur de la silhouette du cou pour la rotation de tête `headYaw`. */
  halfAt(headYaw: number): number;
}

export function neckOf(lm: FaceLandmarks, skull: Skull): Neck {
  const a = lm.neck.half;
  const b = lm.neck.depthRatio * lm.neck.depthHalf;
  const yawOf = (headYaw: number): number => headYaw * lm.neck.twistShare;
  const halfAt = (headYaw: number): number => {
    const t = (yawOf(headYaw) * Math.PI) / 180;
    return Math.hypot(a * Math.cos(t), b * Math.sin(t));
  };
  return { a, b, topY: lm.neck.topY, bottomY: lm.neck.bottomY, zAxis: -0.12 * skull.rz, twistShare: lm.neck.twistShare, yawOf, halfAt };
}
