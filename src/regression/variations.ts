import { gridDistance } from './diff';

/**
 * ÉVALUATION DES VARIATIONS sur graines fixes : un générateur peut être « valide » et produire dix fois le même visage, ou
 * un visage hors norme une fois sur cent. Trois mesures observables, calculées sur des signatures d'image (grille de luminance) :
 *  - diversité : distance minimale et moyenne entre paires de visages (un minimum nul = doublon) ;
 *  - dispersion : écart-type de chaque mesure de structure entre visages (écart-type nul = axe qui ne varie pas) ;
 *  - valeurs aberrantes : visages dont la signature est à plus de `k` écarts-types de la médiane des distances (|z| robuste, MAD).
 */
export interface VariationReport {
  readonly n: number;
  readonly minDistance: number;
  readonly meanDistance: number;
  readonly closestPair: readonly [number, number];
  readonly outliers: readonly number[];
  readonly flatMeasures: readonly string[];
}

export function evaluateVariations(grids: readonly (readonly number[])[], measures: readonly Readonly<Record<string, number>>[], k = 3.5): VariationReport {
  const n = grids.length;
  let min = Infinity; let sum = 0; let cnt = 0; let pair: [number, number] = [0, 0];
  const mean: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = gridDistance(grids[i]!, grids[j]!);
    sum += d; cnt++; mean[i]! += d; mean[j]! += d;
    if (d < min) { min = d; pair = [i, j]; }
  }
  // Distance moyenne de chaque visage aux autres ; aberrant = très loin de la médiane (z robuste par MAD).
  const per = mean.map((m) => m / Math.max(1, n - 1));
  const sorted = [...per].sort((a, b) => a - b);
  const med = sorted[Math.floor(n / 2)]!;
  const mad = [...per].map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(n / 2)]! || 1e-9;
  const outliers = per.map((v, i) => ((0.6745 * (v - med)) / mad > k ? i : -1)).filter((i) => i >= 0);
  const keys = Object.keys(measures[0] ?? {});
  const flat = keys.filter((key) => {
    const vs = measures.map((m) => m[key] ?? 0); const mu = vs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(vs.reduce((a, b) => a + (b - mu) ** 2, 0) / n) < 1e-9;
  });
  return { n, minDistance: min, meanDistance: sum / Math.max(1, cnt), closestPair: pair, outliers, flatMeasures: flat };
}
