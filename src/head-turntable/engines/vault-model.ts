import { clamp, smooth } from '../math';
import type { Row } from '../types';
import type { EngineHead } from './face-model';
import { hasSkullModel } from './skull-model';
import { skullOf } from './skull-of';

/**
 * MODÈLE DE LA VOÛTE CRÂNIENNE (coupes). Il MODIFIE les rangées déjà produites par `rows.ts` / `skull-model.ts` (même table, mêmes champs a, zf, zb, pf, qf, pb, qb) ;
 * ce n'est pas un second moteur de crâne. Chaque mesure de `VaultParams` agit sur UNE région (poids gaussien en hauteur y, U) et sur UN champ :
 *   cranialBreadth  → a (demi-largeur) sur toute la voûte, éteint avant la pommette : la largeur osseuse ne suit plus celle du visage ;
 *   templeBreadth   → a au niveau des tempes seulement ;       parietalFlat → a, zf, zb près du sommet (calotte plate / pointue) ;
 *   frontalFlat     → pf (plan frontal plat)  ;  frontalBreadth → qf (front large dans la moitié avant, la largeur max `a` ne bouge pas) ;
 *   parietalConvexity, temporalFlat, planeTransition → qf, qb (rondeur des plans latéraux et angle des transitions frontal / temporal / pariétal) ;
 *   occipitalFlat   → pb, qb ;   occipitalSlope → zb (la partie basse de l'occiput recule ou surplombe) ;
 *   vaultHeight     → hauteur RÉELLE : le sommet monte ou descend de `RISE` U par unité d'écart à la valeur de référence (face), la calotte est étirée verticalement (C¹) ;
 *                     le visage (yeux, nez, bouche, menton, oreille) ne bouge pas.
 * Valeurs nulles = rangées inchangées (tête identique). Les constantes sont des conventions d'anatomie artistique, justifiées dans `docs/SKULL-VAULT.md`.
 */
export { skullOf };
export const VAULT_MODEL = {
  breadth: 0.12, temple: 0.1, topA: 0.35, topZ: 0.025,
  flatP: 0.9, breadthQ: 0.7, convexQ: 0.45, convexA: 0.04, templeQ: 0.6, transQ: 0.5, occP: 0.9, occQ: 0.4, slopeZ: 0.06,
  rise: 0.16, yK: 0.3, expMin: 1.5, expMax: 3.3,
} as const;

const g = (y: number, c: number, s: number): number => Math.exp(-0.5 * ((y - c) / s) ** 2);
/** Poids de la largeur de la boîte crânienne : 0 au sommet, 1 sur la voûte, 0 avant la pommette. */
export const breadthWeight = (y: number): number => smooth((y - 0.01) / 0.1) * (1 - smooth((y - 0.5) / 0.22));

/** Valeur de référence de `vaultHeight` (celle que le visage implique) : le déplacement réel du sommet est proportionnel à l'écart à cette référence. */
export const vaultRef = (e: EngineHead): number => (e.fit as { vaultHeightRef?: number }).vaultHeightRef ?? 0.5;
/** Montée du sommet (U, > 0 = voûte plus haute). Nulle hors des têtes issues d'un visage (la planche est mesurée). */
export const vaultRise = (e: EngineHead): number => (hasSkullModel(e) ? VAULT_MODEL.rise * (skullOf(e).vaultHeight - vaultRef(e)) : 0);

/** Remappage vertical : hauteur de la tête (maillage) → hauteur source (table des moteurs). Identité au-dessus de `yK`, C¹ en `yK`, sommet (−Δ) → source 0. */
export function warpY(y: number, rise: number): number {
  if (rise === 0 || y >= VAULT_MODEL.yK) return y;
  const top = -rise, t = clamp((y - top) / (VAULT_MODEL.yK - top), 0, 1);
  return y + rise * (1 - smooth(t));
}
/** Inverse de `warpY` (bissection : F est strictement croissante tant que |Δ| < 0,1). */
export function unwarpY(ys: number, rise: number): number {
  if (rise === 0 || ys >= VAULT_MODEL.yK) return ys;
  let lo: number = -rise, hi: number = VAULT_MODEL.yK;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (warpY(m, rise) < ys) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/** Applique les mesures de voûte à une rangée (hauteur SOURCE y). Inchangée si tout est nul ou hors des têtes issues d'un visage. */
export function vaultRow(e: EngineHead, r: Row): Row {
  if (!hasSkullModel(e)) return r;
  const k = skullOf(e), y = r.y, M = VAULT_MODEL;
  const top = g(y, 0.0, 0.08) * smooth(y / 0.03), wF = g(y, 0.2, 0.12), wP = g(y, 0.26, 0.1), wT = g(y, 0.45, 0.09), wTr = g(y, 0.33, 0.12), wO = g(y, 0.32, 0.18);
  const a = r.a * (1 + M.breadth * k.cranialBreadth * breadthWeight(y) + M.temple * k.templeBreadth * g(y, 0.42, 0.1) + M.topA * k.parietalFlat * top + M.convexA * k.parietalConvexity * wP);
  const slope = M.slopeZ * k.occipitalSlope * smooth((y - 0.2) / 0.25) * (1 - smooth((y - 0.62) / 0.15));
  const zf = r.zf + M.topZ * k.parietalFlat * top, zb = r.zb - M.topZ * k.parietalFlat * top + slope;
  const ex = (v: number | undefined, d: number): number => clamp((v ?? 2) + d, M.expMin, M.expMax);
  const lat = -M.convexQ * k.parietalConvexity * wP + M.templeQ * k.temporalFlat * wT - M.transQ * k.planeTransition * wTr;
  const pf = ex(r.pf, M.flatP * k.frontalFlat * wF - M.transQ * k.planeTransition * wTr);
  const qf = ex(r.qf, M.breadthQ * k.frontalBreadth * wF + lat);
  const pb = ex(r.pb, M.occP * k.occipitalFlat * wO);
  const qb = ex(r.qb, M.occQ * k.occipitalFlat * wO + lat);
  return { ...r, a, zf: Math.max(zf, zb + 0.02), zb: Math.min(zb, zf - 0.02), pf, qf, pb, qb };
}

/** Hauteur de maillage des rangées : la hauteur source de chaque rangée est reportée sur le maillage (sommet relevé ou abaissé de Δ). Identité pour Δ = 0. */
export function vaultWarpRows(e: EngineHead, rows: readonly Row[]): Row[] {
  const d = vaultRise(e);
  return d === 0 ? [...rows] : rows.map((r) => ({ ...r, y: unwarpY(r.y, d) }));
}
