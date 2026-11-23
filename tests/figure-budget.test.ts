import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { lightModelOf, litFigure } from '../src/relief';
import { FIGURE_BUDGETS, FIGURE_BUDGET_HEIGHT, calibrationMs, checkBudgets, clearLayerCaches, layerStats, resetLayerStats } from '../src/perf';
import { bodyHost } from '../scripts/lib/body-host';

/** Budgets par composant : chaque couche de la figure reste sous son plafond (en unités de calibration, donc indépendant de la machine). Un composant nouveau sans budget fait échouer. */
const BH = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {});
const model = (az: number) => lightModelOf({ azimuthDeg: az, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' });
const fig = (az: number): void => void litFigure(BH.svg, BH.o, BH.skin, set, model(az), { heightPx: FIGURE_BUDGET_HEIGHT });

describe('budgets par composant de la figure', () => {
  it('chaque couche tient dans son budget (3 rendus à froid)', () => {
    fig(305); const cal = calibrationMs(); resetLayerStats();
    for (let i = 0; i < 3; i++) { clearLayerCaches(); fig(305); }
    const rows = checkBudgets(layerStats(), FIGURE_BUDGETS, cal);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.filter((r) => !r.ok).map((r) => `${r.layer} ${r.units.toFixed(1)} u > ${r.budget}`)).toEqual([]);
  }, 120000);
  it('changer seulement la lumière ne refait ni le relief, ni l’AO, ni le G-buffer, ni l’occlusion', () => {
    clearLayerCaches(); fig(305); resetLayerStats(); fig(120); fig(200);
    const s = layerStats();
    for (const k of ['head.field', 'head.ao', 'body.gbuffer', 'body.occlusion']) { expect(s[k]?.calls ?? 0, `${k} refait`).toBe(0); expect(s[k]!.hits, `${k} réutilisé`).toBe(2); }
    for (const k of ['head.cast', 'body.cast', 'body.shade']) expect(s[k]!.calls, `${k} dépend de la lumière`).toBe(2);
  }, 60000);
  it('contrôle négatif : une couche 3× trop lente, ou sans budget déclaré, échoue', () => {
    const cal = 25, slow = { 'head.cast': { calls: 1, hits: 0, ms: 3 * FIGURE_BUDGETS['head.cast']! * cal } }, none = { 'tete.nouvelle': { calls: 1, hits: 0, ms: 1 } };
    expect(checkBudgets(slow, FIGURE_BUDGETS, cal)[0]!.ok).toBe(false);
    expect(checkBudgets(none, FIGURE_BUDGETS, cal)[0]!.ok).toBe(false);
    expect(checkBudgets({ 'head.cast': { calls: 2, hits: 0, ms: 2 * FIGURE_BUDGETS['head.cast']! * cal * 0.5 } }, FIGURE_BUDGETS, cal)[0]!.ok).toBe(true);
  });
});
