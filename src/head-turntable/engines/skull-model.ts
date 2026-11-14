import { clamp, smooth } from '../math';
import { LENGTH_REF } from '../../skull/derive';
import type { EngineHead } from './face-model';
import { skullOf } from './skull-of';

/**
 * MODÈLE DE SECTION DU CRÂNE (vue de dessus). Jusqu'ici toute coupe horizontale au-dessus de la mâchoire était une ELLIPSE centrée : toutes les têtes, quel que soit leur
 * crâne, avaient la même vue de dessus (seuls la longueur et la largeur changeaient). Or l'identité d'un crâne en rotation tient à ce qu'on voit à 45° – 135° : un occiput
 * aplati (brachycéphale) ou en chignon (dolichocéphale), le point le plus large (pariétal / tempe) plus ou moins en arrière, un front plein ou fuyant, un plan facial plat
 * ou bombé selon les pommettes. Ce module fournit, pour une rangée y, les champs de forme de `Row` : zw (point large), pf / qf (moitié avant), pb / qb (moitié arrière).
 *
 * Contraintes (le profil et la face de FACE ne bougent PAS) : x = 0 donne toujours zf (avant) et zb (arrière) — le profil à 90° est celui du moteur de crâne ; z = zw donne
 * toujours x = a — la silhouette de face à 0° est le contour du moteur de visage. Seules changent les vues intermédiaires, où l'ellipse était fausse.
 * Conventions (bornées, non mesurées sur une personne : voir `docs/HEAD-TURNTABLE-SKULL.md`) :
 *   indice local ci = 2a / (zf − zb) : plus il est grand (tête large et courte), plus l'occiput est PLAT (pb, qb > 2) ; plus `occiput` (chignon) est grand, plus il est POINTU ;
 *   point large : à mi-profondeur, reculé par `occiput`, avancé par `vaultPeak`, ramené vers le porion sur le plan du visage (la plus grande largeur est à l'oreille) ;
 *   avant : voûte et front = `frontalBulge` (front plein → coupe plus carrée) ; plan du visage = `zygoma` (pommettes saillantes → plan facial plat aux angles, sinon arrondi).
 */
export interface SkullShapeParams {
  /** Entrée progressive depuis le vertex (U) : au sommet la coupe reste une ellipse (une calotte). */ readonly top0: number; readonly top1: number;
  /** Début / fin du plan du visage (mélange voûte → visage). */ readonly face0: number; readonly face1: number;
  /** Sortie vers l'ellipse avant que la mâchoire prenne le relais (`JAW_SHAPE.y0` = 0,76). */ readonly out0: number; readonly out1: number;
  /** Indice local neutre et demi-étendue de l'indice. */ readonly ci0: number; readonly ciSpan: number;
  /** Effet de l'aplatissement sur pb / qb, du chignon sur pb. */ readonly pbFlat: number; readonly qbFlat: number; readonly pbBun: number;
  /** Position relative du point large (0 = arrière) : base, effet de vaultPeak, de occiput ; bornes. */ readonly wf0: number; readonly wfPeak: number; readonly wfOcc: number; readonly wfMin: number; readonly wfMax: number;
  /** Exposants avant : front (frontalBulge) et plan du visage (zygoma). */ readonly pfBulge: number; readonly qfBulge: number; readonly pfZyg: number; readonly qfZyg: number;
}
export const SKULL_SHAPE: SkullShapeParams = {
  top0: 0.02, top1: 0.14, face0: 0.2, face1: 0.34, out0: 0.6, out1: 0.76, ci0: 1.1, ciSpan: 0.12, pbFlat: 0.5, qbFlat: 0.35, pbBun: 0.5,
  wf0: 0.5, wfPeak: 0.15, wfOcc: 0.1, wfMin: 0.4, wfMax: 0.6, pfBulge: 0.9, qfBulge: 0.6, pfZyg: 1.3, qfZyg: 1.5,
};

/** Les têtes issues d'un visage quelconque (`mandLandmarks`) ont ce modèle ; la planche garde ses ellipses (identique au pixel). */
export const hasSkullModel = (e: EngineHead): boolean => (e.fit as { mandLandmarks?: boolean }).mandLandmarks === true;

export interface SkullFields { readonly zw: number; readonly pf: number; readonly qf: number; readonly pb: number; readonly qb: number }

/** Poids du modèle de crâne à la hauteur y : 0 au vertex, 1 sur la voûte et le visage, 0 de nouveau avant la mâchoire. */
export const skullWeight = (y: number, sp: SkullShapeParams = SKULL_SHAPE): number => smooth((y - sp.top0) / (sp.top1 - sp.top0)) * (1 - smooth((y - sp.out0) / (sp.out1 - sp.out0)));

/** Champs de forme du crâne pour la rangée y (demi-largeur a, avant zf, arrière zb) ; `null` hors de la zone (vertex, mâchoire). */
export function skullFields(e: EngineHead, y: number, a: number, zf: number, zb: number, sp: SkullShapeParams = SKULL_SHAPE): SkullFields | null {
  const w = skullWeight(y, sp);
  if (w <= 0) return null;
  const k = skullOf(e), d = zf - zb, zc = (zf + zb) / 2, zPor = (e.fit as { zPorion: number }).zPorion;
  const faceW = smooth((y - sp.face0) / (sp.face1 - sp.face0));
  const flat = clamp((2 * a / Math.max(0.05, d + cranialBackShift(e, y)) - sp.ci0) / sp.ciSpan, -1, 1);   // indice local du moteur (profondeur AVANT amplification) : l'aplatissement de l'occiput suit le visage, pas l'amplification
  const wfSkull = clamp(sp.wf0 + sp.wfPeak * (k.vaultPeak - 0.45) - sp.wfOcc * (k.occiput - 0.5), sp.wfMin, sp.wfMax);
  const wfFace = clamp((zPor - 0.02 - zb) / d, sp.wfMin + 0.02, sp.wfMax + 0.02);
  const wf = wfSkull + (wfFace - wfSkull) * faceW;
  const zwT = clamp(zb + wf * d, zb + 0.05 * d, zf - 0.05 * d);
  const pfT = (2 + sp.pfBulge * (k.frontalBulge - 0.5)) * (1 - faceW) + (2 + sp.pfZyg * (k.zygoma - 0.5)) * faceW;
  const qfT = (2 + sp.qfBulge * (k.frontalBulge - 0.5)) * (1 - faceW) + (2 + sp.qfZyg * (k.zygoma - 0.3)) * faceW;
  const pbT = 2 + sp.pbFlat * flat - sp.pbBun * (k.occiput - 0.5), qbT = 2 + sp.qbFlat * flat;
  const lerp = (t: number): number => 2 + (t - 2) * w;
  return { zw: zc + (zwT - zc) * w, pf: lerp(clamp(pfT, 1.6, 2.7)), qf: lerp(clamp(qfT, 1.6, 2.7)), pb: lerp(clamp(pbT, 1.5, 2.8)), qb: lerp(clamp(qbT, 1.8, 2.5)) };
}

/**
 * FORME CRÂNIENNE (dolicho- / brachycéphale) — AMPLIFICATION DE LA LONGUEUR DÉRIVÉE. Le moteur de crâne dérive la longueur de tête du visage (`Derivation.lengthH`) mais l'axe
 * `length` la borne à ±6 % (0,74 – 0,86 H) : les têtes tournent sur un volume presque identique. Ici la longueur utilisée en 3D est L = LENGTH_REF + gain·(lengthH − LENGTH_REF),
 * bornée à [lMin, lMax] (indice céphalique humain 0,70 – 0,90 pour une largeur de crâne ≈ 0,65 H). Conventions de proportion, PAS des moyennes mesurées : voir `docs/HEAD-TURNTABLE-SKULL-2.md`.
 * Tout l'écart est porté par l'ARRIÈRE du crâne (occiput) : le plan du visage, le front, le porion (oreille) et la largeur de face ne bougent pas ; le profil de la planche (sans `cranialL`) non plus.
 */
export const CRANIAL = { gain: 2.0, lMin: 0.72, lMax: 0.92 } as const;
export const cranialLength = (lengthH: number): number => clamp(LENGTH_REF + CRANIAL.gain * (lengthH - LENGTH_REF), CRANIAL.lMin, CRANIAL.lMax);
/** Décalage de l'arrière du crâne (U, négatif = plus long) à la hauteur y ; 0 sans `cranialL` (planche) et hors de la zone du crâne (poids `skullWeight`). */
export function cranialBackShift(e: EngineHead, y: number): number {
  const L0 = (e.fit as { cranialL?: number }).cranialL;
  return L0 === undefined ? 0 : -(cranialLength(L0) - L0) * skullWeight(y);
}
