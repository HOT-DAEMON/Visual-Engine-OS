import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes } from '../../src/body/volume';
import { lightModelOf, litFigure } from '../../src/relief';
import { FIGURE_BUDGETS, FIGURE_BUDGET_HEIGHT, calibrationMs, checkBudgets, clearLayerCaches, layerStats, resetLayerStats } from '../../src/perf';
import { bodyHost } from './body-host';

/** Banc de la FIGURE COMPLÈTE (tête + cou + corps éclairés), appelé par `bench-render.ts` : coût par couche vs budget (à `FIGURE_BUDGET_HEIGHT`), temps réels à 1 100 px. */
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1]!;
export function figureBench(wallHeightPx = 1100, runs = 3): Record<string, unknown> {
  const BH = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {});
  const model = (az: number) => lightModelOf({ azimuthDeg: az, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' });
  const go = (px: number, az: number, extra: object = {}): number => { const t = performance.now(); litFigure(BH.svg, BH.o, BH.skin, set, model(az), { heightPx: px, ...extra }); return performance.now() - t; };
  go(400, 305); const cal = calibrationMs();
  resetLayerStats(); for (let i = 0; i < runs; i++) { clearLayerCaches(); go(FIGURE_BUDGET_HEIGHT, 305); }
  const budgets = checkBudgets(layerStats(), FIGURE_BUDGETS, cal).map((r) => ({ layer: r.layer, msPerCall: +r.msPerCall.toFixed(1), units: +r.units.toFixed(2), budget: r.budget, ok: r.ok }));
  const cold = (extra: object = {}): number => med(Array.from({ length: runs }, () => { clearLayerCaches(); return go(wallHeightPx, 305, extra); }));
  const lightOnly = (extra: object = {}): number => { clearLayerCaches(); go(wallHeightPx, 305, extra); return med([20, 90, 160].map((az) => go(wallHeightPx, az, extra))); };
  return { heightPx: wallHeightPx, calibrationMs: +cal.toFixed(1), budgets, wallMs: { cold: +cold().toFixed(0), lightChangeOnly: +lightOnly().toFixed(0), coldHeadCastScale2: +cold({ headCastScale: 2 }).toFixed(0), lightChangeHeadCastScale2: +lightOnly({ headCastScale: 2 }).toFixed(0) } };
}
