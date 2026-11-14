import { clamp, smooth } from '../math';
import type { EngineHead } from './face-model';
import { skullOf } from './skull-of';
import { skullWeight } from './skull-model';

/**
 * RELIEF DU CRÂNE : BOSSES PARIÉTALES ET ASYMÉTRIE. Les sections du crâne (`rows.ts` + `skull-model.ts`) donnent la FORME D'ENSEMBLE (superellipses) ; elles ne portent
 * ni les deux éminences pariétales (renflements arrondis au-dessus et en arrière de l'oreille, qui font les « épaules » du crâne vues de dos et de trois quarts arrière)
 * ni l'asymétrie qu'a tout crâne réel (aplatissement occipital d'un côté, bombement frontal du côté opposé, éminences de tailles différentes).
 * Ce module renvoie un DÉPLACEMENT RADIAL (U, > 0 = vers l'extérieur) à la hauteur y et à l'azimut th du maillage de la tête ; `mesh.ts` l'applique.
 *
 * Sources (aucun paramètre nouveau n'est inventé : tout est lu dans les moteurs existants) :
 *   amplitude des bosses ← `skull.vaultPeak` (voûte au sommet en arrière → bosses plus marquées) et `skull.vaultHeight` ;
 *   asymétrie            ← `face.asymmetry` (`eyeDy`, `eyeRollDeg`, `mouthTiltDeg` : l'asymétrie crânio-faciale est UNE grandeur, pas trois) ; nulle pour la planche.
 * Constantes de position = conventions d'anatomie artistique (éminence pariétale ≈ au tiers supérieur de la voûte, à 110° du plan de face), NON mesurées sur une personne :
 * elles sont écrites ici avec leur origine et validées par `verify-relief.ts` (signe, localisation, continuité) et par le recoupement des références `rotation-3d`.
 */
export interface SkullReliefParams {
  /** Hauteur (U) et azimut (°, 0 = face, 90 = côté, 180 = nuque) du centre des bosses ; écarts-types. */ readonly yP: number; readonly azP: number; readonly sy: number; readonly saz: number;
  /** Amplitude de base (U) des bosses, et gain de `vaultPeak` / `vaultHeight`. */ readonly a0: number; readonly kPeak: number; readonly kHeight: number; readonly aMin: number; readonly aMax: number;
  /** Asymétrie : amplitude max (U) de l'aplatissement occipital, du bombement frontal, et écart relatif des deux bosses. */ readonly flatOcc: number; readonly bossFront: number; readonly bossSplit: number;
}
export const SKULL_RELIEF: SkullReliefParams = { yP: 0.24, azP: 112, sy: 0.085, saz: 24, a0: 0.02, kPeak: 0.022, kHeight: 0.01, aMin: 0.006, aMax: 0.026, flatOcc: 0.012, bossFront: 0.008, bossSplit: 0.25 };
/** Asymétrie PROPRE du crâne (plagiocéphalie, bosses inégales) : plus ample que celle reportée du visage (quelques mm de tête) pour qu'un crâne asymétrique se lise sous un visage symétrique. */
export const SKULL_OWN_ASYM = { flatOcc: 0.03, bossFront: 0.022, bossSplit: 0.6 } as const;

/** Seules les têtes issues d'un visage (`mandLandmarks`) ont ce relief : le crâne de la planche est ajusté sur une silhouette MESURÉE qui contient déjà ses bosses. */
export const hasSkullRelief = (e: EngineHead): boolean => (e.fit as { mandLandmarks?: boolean }).mandLandmarks === true;

/** Asymétrie du VISAGE (yeux, bouche) signée dans [−1, 1] (+ = côté +x) : moyenne des trois mesures d'asymétrie, ramenées à leur borne. */
export function faceAsymmetry(e: EngineHead): number {
  const a = e.p.asymmetry;
  return clamp((a.eyeDy / 0.012 + a.eyeRollDeg / 4 + a.mouthTiltDeg / 4) / 3, -1, 1);
}
/** Asymétrie crânienne d'une région : part `asymFaceCoupling` de celle du visage + mesure PROPRE de la région (le crâne n'est plus déterminé par le visage). Signée dans [−1, 1]. */
export function skullAsymmetry(e: EngineHead, region: 'parietal' | 'occipital' | 'frontal' = 'parietal'): number {
  const k = skullOf(e);
  return clamp(k.asymFaceCoupling * faceAsymmetry(e) + ownAsymmetry(e, region), -1, 1);
}
/** Part PROPRE de l'asymétrie d'une région (signée, [−1, 1]) : `asymParietal`, `asymOccipital`, −`asymFrontal`. */
export function ownAsymmetry(e: EngineHead, region: 'parietal' | 'occipital' | 'frontal'): number {
  const k = skullOf(e);
  return region === 'parietal' ? k.asymParietal : region === 'occipital' ? k.asymOccipital : -k.asymFrontal;
}

/** Amplitude (U) des bosses pariétales d'une tête : le sommet de la voûte porté en arrière et une voûte haute les accentuent. */
export function parietalAmplitude(e: EngineHead, sp: SkullReliefParams = SKULL_RELIEF): number {
  const k = skullOf(e);
  return clamp(sp.a0 + sp.kPeak * (0.45 - k.vaultPeak) + sp.kHeight * (k.vaultHeight - 0.5), sp.aMin, sp.aMax) * (1 + 0.9 * k.parietalBulge);   // parietalBulge : gain indépendant (−1 : bosses presque effacées … +1 : presque doublées)
}

const g = (d: number, s: number): number => Math.exp(-0.5 * (d / s) ** 2);

/** Déplacement radial du crâne (U) à la hauteur y (U) et à l'azimut th (rad ; 0 = face, + = côté +x). Nul en dehors de la voûte (poids `skullWeight`) et à la face. */
export function skullRelief(e: EngineHead, y: number, th: number, sp: SkullReliefParams = SKULL_RELIEF): number {
  const w = skullWeight(y);
  if (w <= 0) return 0;
  const side = clamp(Math.sin(th) / 0.5, -1, 1), az = (Math.atan2(Math.abs(Math.sin(th)), Math.cos(th)) * 180) / Math.PI;   // côté CONTINU (0 sur le plan médian : pas de saut à la nuque) ; azimut replié dans [0°, 180°]
  const fa = skullOf(e).asymFaceCoupling * faceAsymmetry(e), A = parietalAmplitude(e, sp), O = SKULL_OWN_ASYM, oP = ownAsymmetry(e, 'parietal'), oO = ownAsymmetry(e, 'occipital'), oF = ownAsymmetry(e, 'frontal');
  // Éminences pariétales : gaussienne en y et en azimut ; le côté « fort » de l'asymétrie est plus gros, l'autre plus petit (somme conservée).
  const boss = A * (1 + sp.bossSplit * fa * side + O.bossSplit * oP * side) * g(y - sp.yP, sp.sy) * g(az - sp.azP, sp.saz);
  // Aplatissement occipital du côté +x (asym > 0) et bombement frontal du côté opposé : plagiocéphalie légère, bornée à quelques millimètres de tête.
  const occ = -(sp.flatOcc * Math.max(0, fa * side) + O.flatOcc * Math.max(0, oO * side)) * g(y - 0.3, 0.12) * g(az - 150, 20);
  const front = (sp.bossFront * Math.max(0, -fa * side) + O.bossFront * Math.max(0, -oF * side)) * g(y - 0.18, 0.09) * g(az - 40, 18);
  return w * (boss + occ + front) * smooth(az / 20);   // rien sur le plan médian de face : le profil à 90° et la face à 0° restent ceux des moteurs
}
