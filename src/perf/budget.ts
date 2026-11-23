import type { LayerStat } from './layers';

/**
 * BUDGETS PAR COMPOSANT de la figure (docs/PERF-4.md) : chaque couche a un plafond de coût par calcul, pour que les composants à venir n'effacent pas les gains.
 * Les plafonds sont exprimés en UNITÉS DE CALIBRATION (durée d'une charge flottante fixe, mesurée sur la machine qui exécute le test), pas en millisecondes :
 * un budget en millisecondes serait faux sur une machine plus lente ou plus rapide. `FIGURE_BUDGETS` a été fixé à ≈ 2,5× le coût mesuré (marge de bruit) à `FIGURE_BUDGET_HEIGHT` px.
 */
export const FIGURE_BUDGET_HEIGHT = 600;

/** Plafond par calcul de chaque couche, en unités de calibration (coût mesuré à 600 px, cache froid : champ 14, ombre tête 17, AO 3,4, G-buffer 19, occlusion 1,8, ombre corps 2,4, ombrage 2,4, PNG 0,85). */
export const FIGURE_BUDGETS: Readonly<Record<string, number>> = {
  'head.field': 35, 'head.cast': 42, 'head.ao': 9, 'body.gbuffer': 48, 'body.occlusion': 5, 'body.cast': 6, 'body.shade': 6, 'body.encode': 2.5,
};

/** Charge de calibration fixe : somme de produits sur un tampon `Float32Array` de 1 M d'éléments (même nature de calcul que les couches). Médiane de 5 mesures, en ms. */
export function calibrationMs(): number {
  const a = new Float32Array(1 << 20); for (let i = 0; i < a.length; i++) a[i] = (i * 2654435761 % 1000) / 1000;
  const run = (): number => { const t0 = Number(process.hrtime.bigint()) / 1e6; let s = 0; for (let r = 0; r < 6; r++) for (let i = 0; i < a.length; i++) s += Math.sqrt(a[i]! * a[i]! + 0.5) * Math.sin(a[i]!); if (s === 0.123) a[0] = 1; return Number(process.hrtime.bigint()) / 1e6 - t0; };
  run(); const t = [run(), run(), run(), run(), run()].sort((x, y) => x - y); return t[2]!;
}

export interface BudgetRow { readonly layer: string; readonly calls: number; readonly msPerCall: number; readonly units: number; readonly budget: number; readonly ok: boolean }
/** Compare le coût par calcul de chaque couche à son budget. Une couche sans budget déclaré est signalée `ok: false` : tout composant nouveau doit déclarer le sien. */
export function checkBudgets(stats: Record<string, LayerStat>, budgets: Readonly<Record<string, number>>, cal: number): BudgetRow[] {
  return Object.entries(stats).filter(([, s]) => s.calls > 0).map(([layer, s]) => {
    const msPerCall = s.ms / s.calls, units = msPerCall / cal, budget = budgets[layer] ?? 0;
    return { layer, calls: s.calls, msPerCall, units, budget, ok: budget > 0 && units <= budget };
  });
}
