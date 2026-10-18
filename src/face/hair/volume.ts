import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';

/**
 * Gain d'enveloppe par côté (silhouette asymétrique). `s` ∈ [−1, 1] est l'abscisse normalisée de la racine
 * (−1 = bord gauche de l'image). Avec `asymmetry` = 0 le gain vaut 1 partout (symétrique). Sinon le côté `bias`
 * est renforcé (jusqu'à ×2,1) et le côté opposé réduit (jusqu'à ×0,35) : la silhouette devient franchement
 * dissymétrique, avec une transition lisse (puissance 0,8) à travers le milieu.
 */
export function makeGain(sil: FaceParams['hair']['silhouette'], nz: (x: number) => number): (s: number) => number {
  if (sil.asymmetry < 0.01) return () => 1;
  // Sans côté imposé, le bruit de la graine choisit un côté (déterministe).
  const bias = sil.bias !== 0 ? sil.bias : nz(0.37) >= 0 ? 1 : -1;
  return (s) => {
    const side = Math.sign(s) * Math.abs(s) ** 0.8;
    return clamp(1 + sil.asymmetry * bias * side * 1.1, 0.35, 2.1);
  };
}

/** Gonflement de la masse, fraction de W : 0,16 W au maximum, ajouté à l'enveloppe en haut ET sur les côtés. */
export const puffWidth = (puff: number): number => puff * 0.16;

/**
 * Racines relevées à la raie. Autour de l'abscisse `partX` (largeur `rootLift.width·W`), la direction initiale d'une
 * mèche est tirée vers le HAUT (poids = relevé × profil en cloche) puis la gravité ajoutée la fait RETOMBER :
 * `fall` = 0 reste dressé, 1 retombe franchement. Hors de la zone : aucun effet.
 */
export function makeLift(h: FaceParams['hair'], partX: number, W: number): (R: Vec, dir: Vec) => { dir: Vec; gravity: number } {
  const lift = h.rootLift;
  if (lift.amount < 0.01) return (_R, dir) => ({ dir, gravity: 0 });
  const half = Math.max(0.02, lift.width) * W * 0.5;
  return (R, dir) => {
    // Profil en cloche (gaussienne) de la distance à la raie, en demi-largeurs.
    const k = Math.exp(-(((R.x - partX) / half) ** 2)) * lift.amount;
    const d = { x: dir.x * (1 - 0.8 * k), y: dir.y * (1 - 0.8 * k) - 1.1 * k };
    const n = Math.hypot(d.x, d.y) || 1;
    return { dir: { x: d.x / n, y: d.y / n }, gravity: k * (0.3 + 1.9 * lift.fall) };
  };
}

/** Bosse de volume sous la raie (px) à l'abscisse x : s'ajoute à l'enveloppe de la sous-couche. */
export const liftBump = (h: FaceParams['hair'], partX: number, W: number, H: number, x: number): number => {
  if (h.rootLift.amount < 0.01) return 0;
  const half = Math.max(0.02, h.rootLift.width) * W * 0.6;
  return h.rootLift.amount * 0.07 * H * Math.exp(-(((x - partX) / half) ** 2));
};
