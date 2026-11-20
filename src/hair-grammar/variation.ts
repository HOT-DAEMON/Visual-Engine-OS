import { sampleLock, type HairProfile } from './grammar';
import type { LockSpec } from './lock';
import { clamp, norm, prng, v3, type V3 } from './vec';

/**
 * VARIATION PAR NIVEAUX INDÉPENDANTS. `generate(P, seed)` tire tous les champs d'une mèche dans UN flux : changer la graine change tout.
 * Ici chaque NIVEAU a son propre flux ; `sampleLock` consomme un nombre FIXE de tirages par mèche, donc les flux restent alignés mèche à
 * mèche et un niveau ne perturbe jamais les autres (propriété testée : tests/hair-engine-intent.test.ts).
 *   silhouette  racine (él., az.), cap, longueur       masses   largeur, point de plus grande largeur
 *   strands     nombre de brins, ton                   tips     effilement, retroussé de pointe
 *   texture     ondulation, courbure                   volume   décollement racine/pointe, exposant, gravité
 *   asymmetry   (global) déséquilibre G/D de largeur et de longueur + rotation d'ensemble du cap
 */
export const LEVELS = ['silhouette', 'masses', 'strands', 'tips', 'texture', 'volume', 'asymmetry'] as const;
export type Level = (typeof LEVELS)[number];
export type Seeds = Readonly<Record<Level, number>>;
export const seedsFrom = (seed: number): Seeds => Object.fromEntries(LEVELS.map((l, i) => [l, seed * 1000 + i * 97 + 1])) as Seeds;

const rotZ = (v: V3, a: number): V3 => v3(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a), v.z);

export interface Asymmetry { readonly side: number; readonly twist: number }
/** Déséquilibre global tiré de la graine du niveau `asymmetry` (borné : ±0,35 en largeur log, ±0,12 rad de cap). */
export const asymmetryOf = (seed: number, amount = 1): Asymmetry => { const g = prng(seed); return { side: (g() * 2 - 1) * 0.35 * amount, twist: (g() * 2 - 1) * 0.12 * amount }; };

export function generateLevels(P: HairProfile, seeds: Seeds, asymmetry = 1): LockSpec[] {
  const g = Object.fromEntries(LEVELS.map((l) => [l, prng(seeds[l])])) as Record<Level, () => number>;
  const A = asymmetryOf(seeds.asymmetry, asymmetry); const out: LockSpec[] = [];
  for (const F of P.families) for (let i = 0; i < F.count; i++) {
    // Un tirage COMPLET par niveau (flux alignés), puis chaque niveau ne prête que ses champs.
    const s = Object.fromEntries(LEVELS.filter((l) => l !== 'asymmetry').map((l) => [l, sampleLock(P, F, i, g[l])])) as Record<Exclude<Level, 'asymmetry'>, LockSpec>;
    const sil = s.silhouette; const side = Math.sign(Math.sin((sil.root.az * Math.PI) / 180)) || 1;
    out.push({
      ...sil, aim: norm(rotZ(sil.aim, A.twist)), length: sil.length * Math.exp(0.4 * A.side * side), width: s.masses.width * Math.exp(A.side * side), peak: s.masses.peak,
      strands: s.strands.strands, tone: s.strands.tone, taper: s.tips.taper, flick: s.tips.flick, wave: s.texture.wave, bend: s.texture.bend,
      lift0: s.volume.lift0, lift1: s.volume.lift1, liftPow: s.volume.liftPow, gravity: s.volume.gravity,
    });
  }
  return out;
}

/** Champs de `LockSpec` que chaque niveau détermine (sert au test d'indépendance et à la doc). */
export const LEVEL_FIELDS: Readonly<Record<Exclude<Level, 'asymmetry'>, readonly (keyof LockSpec)[]>> = {
  silhouette: ['root', 'aim', 'length'], masses: ['width', 'peak'], strands: ['strands', 'tone'], tips: ['taper', 'flick'], texture: ['wave', 'bend'], volume: ['lift0', 'lift1', 'liftPow', 'gravity'],
};
export const clampSeeds = (s: Seeds): Seeds => Object.fromEntries(LEVELS.map((l) => [l, clamp(Math.floor(s[l]), 1, 2 ** 31)])) as Seeds;
