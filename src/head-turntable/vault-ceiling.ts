import type { SkullParams } from '../skull/types';
import { vaultRelief } from './engines/vault-relief';
import { vaultSpec } from './vault-lab';

/**
 * TABLE DES PLAFONDS DE RELIEF SELON LES TISSUS (`docs/SKULL-VAULT-3.md`) : le relief osseux traverse la peau atténué par la transmission τ (`vault-tissue.ts`), qui monte jusqu'à 1,6 pour un cuir chevelu mince et un os apparent.
 * Plafond = la plus grande valeur du paramètre (0 … 1, dans le sens où il est le plus fort) pour laquelle le relief SEUL respecte les bornes de la couche de vérification (`verify-vault.ts` : amplitude ≤ 0,06 U, saut entre échantillons
 * voisins ≤ 0,014 U), pour chaque cellule (`scalp`, `boneShow`). 1 = aucune limite ; < 1 = la valeur extrême est une impossibilité physique dans cette cellule (plus de relief que ce que la peau peut porter sans arête).
 * Mesuré sur le relief réel de la tête (même fonction que le maillage), pas déduit des amplitudes : un changement de forme met la table à jour.
 */
export const CEILING_LIMITS = { amp: 0.06, step: 0.014 } as const;
export const CEILING_SCALP = [0.05, 0.5, 0.95] as const, CEILING_BONE = [-1, 0, 1] as const;
/** Paramètres qui produisent du relief de voûte (vaultRelief) ; l'asymétrie de largeur est une dissymétrie de coupe, hors table. */
export const CEILING_PARAMS = ['temporalHollow', 'mastoid', 'glabella', 'nuchalLine', 'frontalEminence', 'browArch', 'metopicRidge', 'occipitalBun', 'inionSize', 'temporalLine', 'temporalMuscle', 'asterion', 'nuchalGroove', 'suturesShow'] as const;
const D = 180 / Math.PI;

/** Plus grande amplitude (U) et plus grand saut (U) du relief de voûte d'une tête, mêmes pas que la vérification (0,0125 U en hauteur, 3° en azimut). */
export function reliefExtent(ov: Partial<SkullParams>, seed?: number): { amp: number; step: number } {
  const e = vaultSpec(ov, seed).engine!; let amp = 0, step = 0;
  for (let y = 0.02; y <= 1.0; y += 0.0125) for (let az = 0; az <= 180; az += 3) {
    const v = vaultRelief(e, y, az / D); amp = Math.max(amp, Math.abs(v));
    if (az > 0) step = Math.max(step, Math.abs(v - vaultRelief(e, y, (az - 3) / D)));
    if (y > 0.02) step = Math.max(step, Math.abs(v - vaultRelief(e, y - 0.0125, az / D)));
  }
  return { amp, step };
}
export interface CeilingCell { readonly scalp: number; readonly boneShow: number; readonly max: number; readonly limitedBy: 'amp' | 'step' | null; readonly amp: number; readonly step: number }
/** Plafond d'un paramètre pour une cellule de tissus. */
export function ceilingOf(param: (typeof CEILING_PARAMS)[number], scalp: number, boneShow: number, seed?: number): CeilingCell {
  let worst = { amp: 0, step: 0 };
  for (const sign of param === 'suturesShow' ? [1] : [1, -1]) { const x = reliefExtent({ [param]: sign, scalp, boneShow } as Partial<SkullParams>, seed); if (x.amp > worst.amp) worst = x; }
  const ka = worst.amp > 0 ? CEILING_LIMITS.amp / worst.amp : Infinity, ks = worst.step > 0 ? CEILING_LIMITS.step / worst.step : Infinity, max = Math.min(1, ka, ks);
  return { scalp, boneShow, max, limitedBy: max >= 1 ? null : ka <= ks ? 'amp' : 'step', ...worst };
}
export const ceilingTable = (seed?: number): Record<string, CeilingCell[]> =>
  Object.fromEntries(CEILING_PARAMS.map((p) => [p, CEILING_SCALP.flatMap((s) => CEILING_BONE.map((b) => ceilingOf(p, s, b, seed)))]));

/**
 * Plafond de la COMBINAISON : tous les reliefs de la table réglés à la même fraction s de leur extrême (signe `sign`), les tissus de la cellule ; plus grand s ∈ [0, 1] qui respecte les bornes (bissection, 9 pas).
 * C'est la vraie limite physique : chaque relief seul tient, tous ensemble sous une peau mince ne tiennent pas forcément. `suturesShow` reste positif (plage [0, 1]).
 */
export function comboCeiling(sign: 1 | -1, scalp: number, boneShow: number, seed?: number): { s: number; amp: number; step: number } {
  const ov = (s: number) => reliefExtent({ ...Object.fromEntries(CEILING_PARAMS.map((p) => [p, p === 'suturesShow' ? s : sign * s])), scalp, boneShow } as Partial<SkullParams>, seed);
  const ok = (x: { amp: number; step: number }): boolean => x.amp <= CEILING_LIMITS.amp && x.step <= CEILING_LIMITS.step;
  const full = ov(1); if (ok(full)) return { s: 1, ...full };
  let lo = 0, hi = 1, best = ov(0);
  for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2, x = ov(m); if (ok(x)) { lo = m; best = x; } else hi = m; }
  return { s: lo, ...best };
}
