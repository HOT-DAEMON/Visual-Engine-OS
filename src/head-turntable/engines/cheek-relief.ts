import { clamp, smooth } from '../math';
import type { EngineHead } from './face-model';
import { noseLandmarks } from './nose-mouth';
import { fy } from './units';

/**
 * MODELÉ DES JOUES EN 3D. Jusqu'ici la joue de la tête en rotation était une coupe elliptique mélangée à la mâchoire (`rows.ts` + `jaw-model.ts`) : ni pommette, ni creux sous la pommette,
 * ni masséter, alors que le moteur de visage les porte déjà (`FaceCheek` : `boneProjection`, `volume`, `hollow`, `masseterBlend`, `lateralWidth` ; `softTissue.masseter.volume`).
 * La joue est un ENFANT DU VISAGE : sa position (hauteur) est lue sur les repères du visage (ligne des yeux, base du nez, bouche), son amplitude sur ces paramètres.
 *
 * Le module renvoie un DÉPLACEMENT RADIAL (U, > 0 = vers l'extérieur) à la hauteur y et à l'azimut th, appliqué par `mesh.ts`. Quatre termes, tous en gaussiennes (continus, sans arête) :
 *   pommette (os zygomatique)  : y ≈ ligne des yeux + 0,6 × (base du nez − ligne des yeux), azimut ≈ 50° ; amplitude ← `boneProjection` (0,35 = neutre, car le contour de face en porte déjà une part) ;
 *   plénitude de la joue       : plus large, un peu plus bas ; ← `volume` (0,45 neutre) ;
 *   creux sous la pommette     : fosse infra-zygomatique, ← `hollow`, CREUSE, adoucie par `masseterBlend` ;
 *   masséter                   : renflement de la branche de la mandibule, ← `softTissue.masseter.volume` et `masseterBlend`.
 * Ce que le contour 2D impose reste vrai : tous les termes sont multipliés par une fenêtre qui s'éteint à 90° (la silhouette de face à 0° est le contour du moteur de visage, contrôle
 * `head.geo.front2d`) et à la face (< 10° : le nez et les lèvres ont leurs propres bosses). Les gains sont des conventions d'anatomie artistique, PAS des mesures : voir `docs/HEAD-TURNTABLE-CHEEK.md`.
 */
export interface CheekReliefParams {
  readonly azZ: number; readonly sazZ: number; readonly syZ: number; readonly gZ: number; readonly zNeutral: number;
  readonly azV: number; readonly sazV: number; readonly syV: number; readonly dyV: number; readonly gV: number; readonly vNeutral: number;
  readonly azH: number; readonly sazH: number; readonly syH: number; readonly dyH: number; readonly gH: number;
  readonly azM: number; readonly sazM: number; readonly syM: number; readonly gM: number;
  /** Fenêtre en azimut : montée entre w0 et w1 (face), descente entre d0 et d1 (côté). */ readonly w0: number; readonly w1: number; readonly d0: number; readonly d1: number;
  /** Fenêtre en hauteur : la joue ne déborde ni sur le crâne (au-dessus) ni sur le menton (au-dessous), en U. */ readonly yTop: number; readonly yBot: number;
}
export const CHEEK_RELIEF: CheekReliefParams = {
  azZ: 52, sazZ: 15, syZ: 0.055, gZ: 0.045, zNeutral: 0.35,
  azV: 58, sazV: 20, syV: 0.085, dyV: 0.07, gV: 0.06, vNeutral: 0.45,
  azH: 66, sazH: 13, syH: 0.045, dyH: 0.12, gH: 0.05,
  azM: 74, sazM: 10, syM: 0.06, gM: 0.045,
  w0: 8, w1: 24, d0: 72, d1: 90, yTop: 0.45, yBot: 1.0,
};

const g = (d: number, s: number): number => Math.exp(-0.5 * (d / s) ** 2);

/** Hauteurs (U) des repères de la joue d'une tête : pommette, plénitude, creux, masséter. */
export function cheekLevels(e: EngineHead, sp: CheekReliefParams = CHEEK_RELIEF): { yZ: number; yV: number; yH: number; yM: number } {
  const eye = fy(e.lm.eyeY), nb = noseLandmarks(e).baseY, mouth = fy(e.lm.mouthY);
  const yZ = eye + 0.6 * (nb - eye);
  return { yZ, yV: yZ + sp.dyV, yH: yZ + sp.dyH, yM: Math.max(nb, mouth) + 0.04 };
}

/** Déplacement radial de la joue (U) à la hauteur y et à l'azimut th (rad ; 0 = face, + = côté +x ; symétrique : le modelé est le même des deux côtés, l'asymétrie est portée par le crâne). */
export function cheekRelief(e: EngineHead, y: number, th: number, sp: CheekReliefParams = CHEEK_RELIEF): number {
  const wy = smooth((y - sp.yTop) / 0.08) * (1 - smooth((y - (sp.yBot - 0.1)) / 0.1));
  if (wy <= 0) return 0;
  const az = (Math.atan2(Math.abs(Math.sin(th)), Math.cos(th)) * 180) / Math.PI, waz = smooth((az - sp.w0) / (sp.w1 - sp.w0)) * (1 - smooth((az - sp.d0) / (sp.d1 - sp.d0)));
  if (waz <= 0) return 0;
  const c = e.p.cheek, m = clamp(e.p.softTissue.masseter.volume, 0, 1), L = cheekLevels(e, sp), soft = 1 - 0.5 * c.masseterBlend;
  const zyg = sp.gZ * (c.boneProjection - sp.zNeutral) * g(y - L.yZ, sp.syZ) * g(az - sp.azZ, sp.sazZ);
  const vol = sp.gV * (c.volume - sp.vNeutral) * g(y - L.yV, sp.syV) * g(az - sp.azV, sp.sazV);
  const hol = -sp.gH * c.hollow * soft * g(y - L.yH, sp.syH) * g(az - sp.azH, sp.sazH);
  const mas = sp.gM * (0.4 * c.masseterBlend + 0.6 * m) * g(y - L.yM, sp.syM) * g(az - sp.azM, sp.sazM);
  return wy * waz * (zyg + vol + hol + mas);
}
