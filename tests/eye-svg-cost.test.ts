import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { SVG_COST_MAX_MS, SVG_COST_MODEL, svgCostMs, svgFeatures } from '../src/verify/eye-cost';
import { verifyEye } from '../src/verify/eye';

/** Passe 15 : le seuil `svg-weight` (140 ko) est remplacé par un coût de rastérisation prédit, ajusté sur le temps MESURÉ (scripts/eye-refs/calibrate-svg-cost.ts). */
const M = JSON.parse(readFileSync('references/eyes/measures-svg-cost.json', 'utf8'));

describe('coût de rastérisation prédit (svg-cost)', () => {
  it('les constantes du modèle sont celles du JSON mesuré', () => {
    expect(SVG_COST_MODEL.intercept).toBeCloseTo(M.modele.intercept, 3);
    expect(SVG_COST_MODEL.filterApps).toBeCloseTo(M.modele.filterApps, 3);
    expect(SVG_COST_MODEL.kb).toBeCloseTo(M.modele.kb, 3);
    expect(M.yeux).toBeGreaterThanOrEqual(100);
    expect(M.correlations.filterApps).toBeGreaterThan(M.correlations.kb); // le proxy en ko était le mauvais : les filtres expliquent davantage
    expect(SVG_COST_MAX_MS).toBeGreaterThan(M.ms.median * 2); expect(SVG_COST_MAX_MS).toBeLessThan(M.ms.max * 1.2);
  });
  it('svgFeatures compte les APPLICATIONS de filtre, pas les définitions', () => {
    const svg = '<defs><filter id="a"/></defs><path d="M0 0" filter="url(#a)"/><circle r="1" filter="url(#a)"/><ellipse rx="1"/>';
    const f = svgFeatures(svg);
    expect(f.filterApps).toBe(2); expect(f.nodes).toBe(3);
  });
  it('contre-exemple : 40 applications de filtre dépassent le plafond ; 5 non', () => {
    const heavy = svgFeatures('<path filter="url(#a)"/>'.repeat(40)); const light = svgFeatures('<path filter="url(#a)"/>'.repeat(5));
    expect(svgCostMs(heavy)).toBeGreaterThan(SVG_COST_MAX_MS); expect(svgCostMs(light)).toBeLessThan(SVG_COST_MAX_MS);
  });
  it('galerie 4 : la règle svg-cost remplace svg-weight (44 avertissements sur 100 avant, aucun œil de la galerie au-dessus du plafond maintenant)', () => {
    for (const i of [0, 33, 91]) {
      const r = verifyEye(generateExtra4Eye(i) as never); const ids = r.checks.map((c) => c.id);
      expect(ids).toContain('svg-cost'); expect(ids).not.toContain('svg-weight');
      expect(r.checks.find((c) => c.id === 'svg-cost')!.ok).toBe(true);
    }
  }, 180_000);
});
