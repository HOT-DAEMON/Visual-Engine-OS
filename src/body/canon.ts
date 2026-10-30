import { clamp } from '../core/math';

/**
 * CANON DES PROPORTIONS PAR ÂGE — CONVENTIONS D'ATELIER (dessin d'anatomie), PAS des mesures d'une population.
 * Unité = 1 hauteur de tête `h` (sommet → menton). Valeurs interpolées linéairement entre les âges-clés ci-dessous ; l'ordre de grandeur suit
 * le canon classique (nouveau-né ≈ 4 têtes, adulte ≈ 7,5 têtes ; la tête grandit moins vite que le corps). Elles sont la SEULE source des
 * proportions : `frame.ts` les module par les axes (sexe, adiposité, musculature), `verify/body.ts` les recoupe par des bandes de tolérance.
 * Toute valeur modifiée ici change le test de bandes — rien n'est caché dans le rendu.
 */
const AGES = [0, 1, 2, 6, 10, 15, 20, 70, 95] as const;
const T = {
  heads: [4.0, 4.5, 5.0, 6.0, 6.75, 7.25, 7.5, 7.3, 7.1],
  /** base du cou → nombril */
  torso: [0.78, 0.84, 0.9, 1.05, 1.22, 1.38, 1.5, 1.46, 1.4],
  /** demi-largeur bideltoïdienne (androgyne, musculature moyenne) */
  shoulder: [0.62, 0.66, 0.7, 0.8, 0.88, 0.95, 0.96, 0.93, 0.9],
  /** demi-largeur du tronc à l'aisselle / à la taille / à la crête iliaque */
  chest: [0.5, 0.52, 0.54, 0.58, 0.62, 0.68, 0.72, 0.7, 0.68],
  waist: [0.52, 0.52, 0.5, 0.48, 0.49, 0.52, 0.54, 0.56, 0.56],
  hip: [0.5, 0.5, 0.5, 0.52, 0.55, 0.6, 0.61, 0.61, 0.6],
  /** base du cou → acromion (chute de l'épaule) */
  acromion: [0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.115, 0.13, 0.15],
  upperArm: [0.9, 0.95, 1.0, 1.15, 1.28, 1.34, 1.36, 1.34, 1.3],
  forearm: [0.75, 0.8, 0.88, 0.98, 1.08, 1.13, 1.15, 1.12, 1.08],
  /** poignet → bout du majeur */
  hand: [0.5, 0.55, 0.62, 0.7, 0.76, 0.79, 0.8, 0.79, 0.78],
  armHalf: [0.22, 0.2, 0.17, 0.15, 0.16, 0.175, 0.185, 0.165, 0.15],
  foreHalf: [0.19, 0.17, 0.145, 0.125, 0.135, 0.15, 0.16, 0.145, 0.13],
  wristHalf: [0.1, 0.095, 0.09, 0.085, 0.095, 0.11, 0.115, 0.11, 0.105],
  palmHalf: [0.12, 0.13, 0.14, 0.15, 0.165, 0.18, 0.185, 0.18, 0.175],
} as const;
export type CanonKey = keyof typeof T;
export type Canon = { readonly [K in CanonKey]: number };

export function canonAt(age: number): Canon {
  const a = clamp(age, 0, 95);
  let i = 0;
  while (i < AGES.length - 2 && a > (AGES[i + 1] as number)) i++;
  const a0 = AGES[i] as number, a1 = AGES[i + 1] as number;
  const t = (a - a0) / (a1 - a0);
  const out: Record<string, number> = {};
  for (const k of Object.keys(T) as CanonKey[]) { const r = T[k]; out[k] = (r[i] as number) + ((r[i + 1] as number) - (r[i] as number)) * t; }
  return out as Canon;
}

const step = (a: number, lo: number, hi: number): number => { const x = clamp((a - lo) / (hi - lo), 0, 1); return x * x * (3 - 2 * x); };
/** Porte de puberté 0 → 1 (10 → 17 ans) : le dimorphisme sexuel de la silhouette n'existe pas avant. */
export const puberty = (age: number): number => step(age, 10, 17);
/** Porte de vieillesse 0 → 1 (55 → 85 ans) : chute des épaules, perte de masse musculaire, tissus relâchés. */
export const senior = (age: number): number => step(age, 55, 85);
/** Maturité musculaire 0 → 1 : un bébé n'a pas de relief musculaire visible (3 → 18 ans). */
export const muscleMaturity = (age: number): number => step(age, 3, 18);

export type Stage = 'baby' | 'child' | 'teen' | 'adult' | 'elder';
export function stageOf(age: number): Stage { return age < 2 ? 'baby' : age < 12 ? 'child' : age < 18 ? 'teen' : age < 65 ? 'adult' : 'elder'; }
