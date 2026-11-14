import { smooth } from './math';

/** Hachage entier déterministe → [0, 1) : (i, j, graine). Source unique du dessin des mèches et de la longueur des mèches pendantes. */
export const h2 = (i: number, j: number, s: number): number => { let h = (Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/** Colonnes de mèches autour de la tête, par texture (entier : le motif est périodique en azimut, sans raccord à 360°). */
export const CELLS: Record<string, number> = { straight: 72, wavy: 72, curly: 48, coily: 60, braided: 72 };

/** Bruit de valeurs 1D lisse le long d'une colonne (période `L`). */
export const vnoise = (cell: number, v: number, L: number, seed: number): number => { const q = v / L, i = Math.floor(q), f = smooth(q - i); return h2(cell, i, seed) * (1 - f) + h2(cell, i + 1, seed) * f; };

/** Rapport de longueur de l'ourlet des cheveux pendants : chaque colonne de mèches a sa longueur (groupes de 2 à 4 mèches voisines proches, comme les mèches du dessin 2D), jusqu'à `0,16 U` plus courte. */
export const HEM_VAR = 0.16;
export function hemY(texture: string, seed: number, yEnd: number, az: number): number {
  const N = CELLS[texture] ?? 72, f = (az / 360) * N, c = Math.floor(f), t = smooth(f - c), g = (k: number): number => 0.55 * h2(wrap(Math.floor(k / 3), N), 21, seed) + 0.45 * h2(wrap(k, N), 22, seed);
  return yEnd - HEM_VAR * (g(c) * (1 - t) + g(c + 1) * t);
}
