import type { FaceParams } from '../schema';

/**
 * BORNES DES ZONES VERTICALES DU VISAGE (fractions de la hauteur H du crâne au menton) — source unique, lue par `landmarks.ts`,
 * `jaw/params.ts` (estimation du plancher de la bouche), la vérification et les artefacts. Aucune valeur n'est recopiée ailleurs.
 *
 * Une « zone » est un intervalle vertical entre deux repères du visage, mesuré sur les repères RÉSOLUS (jamais sur un paramètre brut) :
 *   cuir chevelu  : sommet du crâne        → ligne d'implantation (centre)
 *   front         : ligne d'implantation   → limite haute de la zone des yeux (sourcils)
 *   yeux          : limite des sourcils    → ligne des yeux
 *   nez           : ligne des yeux         → base du nez
 *   philtrum      : base du nez            → haut de la lèvre supérieure
 *   lèvres        : haut de la lèvre sup.  → bas de la lèvre inf.
 *   menton        : bas de la lèvre inf.   → bas du menton
 * La somme des sept zones vaut exactement H (aucun recouvrement, aucun trou) : c'est un invariant testé.
 *
 * Les bornes ne s'appliquent qu'au moteur `structured` : le moteur `classic` reste strictement identique (références visuelles intactes).
 */
export const ZONE_LIMITS = {
  /** Nez : le nez ne remonte pas vers l'espace entre les yeux (plancher) ; plafond = nez très long. */
  nose: { min: 0.17, max: 0.26 },
  /** Philtrum (base du nez → haut de la lèvre) : jamais trop long (plafond) ni écrasé (plancher). */
  philtrum: { min: 0.06, max: 0.115 },
  /** Menton (bas de la lèvre inférieure → bas du menton). */
  chin: { min: 0.07, max: 0.24 },
  /** Front (implantation → sourcils) en fraction de H, et part du front dans la hauteur crâne→ligne des yeux. */
  forehead: { min: 0.09, max: 0.3 },
  foreheadShare: { min: 0.18, max: 0.55 },
} as const;

export const usesZones = (p: FaceParams): boolean => p.anatomyEngine === 'structured';

/** Longueur du nez EFFECTIVE (fraction de H) : le nez ne se rapproche jamais de l'espace entre les yeux (moteur `structured`). */
export const noseLengthFrac = (p: FaceParams): number => (usesZones(p) ? Math.max(p.nose.length, ZONE_LIMITS.nose.min) : p.nose.length);

/** Plafond de la ligne de bouche (px depuis le centre) : le philtrum ne dépasse pas `ZONE_LIMITS.philtrum.max` ; `Infinity` en `classic`. */
export function mouthCeilingY(p: FaceParams, H: number, noseBaseY: number): number {
  if (!usesZones(p)) return Infinity;
  const upperH = (0.012 + 0.03 * p.mouth.upperLip) * H;
  return noseBaseY + ZONE_LIMITS.philtrum.max * H + upperH * 0.6;
}

/** Plancher de la ligne de bouche pour que le philtrum ne soit pas écrasé : base du nez + longueur minimale + 60 % de la lèvre supérieure ; `-Infinity` en `classic`. */
export function philtrumFloorY(p: FaceParams, H: number, noseBaseY: number): number {
  if (!usesZones(p)) return -Infinity;
  const upperH = (0.012 + 0.03 * p.mouth.upperLip) * H;
  return noseBaseY + ZONE_LIMITS.philtrum.min * H + upperH * 0.6;
}
