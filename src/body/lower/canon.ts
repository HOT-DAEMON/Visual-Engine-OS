import { clamp } from '../../core/math';

/**
 * CANON DES PROPORTIONS DU BAS DU CORPS PAR ÂGE — CONVENTIONS D'ATELIER (planches d'anatomie : `references/anatomy/ref-03` unités crâniennes,
 * `ref-01` / `ref-02` / `ref-04` figures complètes), PAS des mesures de population. Unité = 1 hauteur de tête `h`, mêmes âges-clés que `../canon.ts`.
 * Invariant verrouillé par `verify/lower.ts` : base du cou + crotch + thigh + shin + ankleH ≈ heads − 1,1 (le corps complet fait bien `heads` têtes).
 */
const AGES = [0, 1, 2, 6, 10, 15, 20, 70, 95] as const;
const T = {
  /** base du cou → fourche (entrejambe) */
  crotch: [1.2, 1.28, 1.4, 1.75, 2.0, 2.25, 2.4, 2.35, 2.3],
  /** fourche → centre du genou */
  thigh: [0.8, 0.98, 1.1, 1.5, 1.7, 1.85, 1.9, 1.85, 1.8],
  /** centre du genou → cheville */
  shin: [0.72, 0.9, 1.1, 1.35, 1.55, 1.7, 1.75, 1.7, 1.6],
  /** cheville → sol */
  ankleH: [0.18, 0.22, 0.25, 0.3, 0.35, 0.35, 0.35, 0.3, 0.3],
  /** longueur du pied (talon → bout du gros orteil), en têtes */
  footLen: [0.6, 0.66, 0.74, 0.85, 0.92, 0.98, 1.0, 0.98, 0.95],
  /** demi-largeur du pied au niveau des métatarsiens */
  footHalf: [0.17, 0.17, 0.17, 0.17, 0.18, 0.19, 0.2, 0.2, 0.2],
  /** demi-largeurs : mi-cuisse, genou, mollet, cheville */
  thighMid: [0.24, 0.23, 0.22, 0.2, 0.215, 0.235, 0.255, 0.245, 0.23],
  knee: [0.155, 0.15, 0.14, 0.13, 0.14, 0.155, 0.165, 0.16, 0.155],
  calf: [0.15, 0.145, 0.135, 0.125, 0.14, 0.16, 0.175, 0.16, 0.14],
  ankle: [0.1, 0.095, 0.09, 0.085, 0.09, 0.1, 0.105, 0.1, 0.095],
} as const;
export type LowerKey = keyof typeof T;
export type LowerCanon = { readonly [K in LowerKey]: number };
export function lowerCanonAt(age: number): LowerCanon {
  const a = clamp(age, 0, 95);
  let i = 0;
  while (i < AGES.length - 2 && a > (AGES[i + 1] as number)) i++;
  const a0 = AGES[i] as number, a1 = AGES[i + 1] as number, t = (a - a0) / (a1 - a0);
  const out: Record<string, number> = {};
  for (const k of Object.keys(T) as LowerKey[]) { const r = T[k]; out[k] = (r[i] as number) + ((r[i + 1] as number) - (r[i] as number)) * t; }
  return out as LowerCanon;
}
