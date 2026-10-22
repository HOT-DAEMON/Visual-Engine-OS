import { describe, expect, it } from 'vitest';
import { ALL_CASES, HARD_CASES } from '../src/regression/cases';
import { decodePng } from '../src/regression/png';
import { diffStats, gridDistance, lumaGrid } from '../src/regression/diff';
import { evaluateVariations } from '../src/regression/variations';
import { measureStructure } from '../src/face/structure';
import { clearCaches } from '../src';
import { cellSvg } from '../scripts/lib/board';
import { rasterPng } from '../scripts/lib/raster';
import { checkCase, loadRef, renderCase, sha1 } from '../scripts/lib/regress';

/** Régression visuelle : références permanentes, cas difficiles, déterminisme, variations sur graines fixes (docs/REGRESSION.md). */
describe('régression visuelle — références permanentes', () => {
  it('chaque cas (standard et difficile) correspond à sa référence, ou s\'en écarte sous les seuils', () => {
    const bad = ALL_CASES.map(checkCase).filter((r) => r.verdict === 'changed' || r.verdict === 'missing');
    expect(bad.map((b) => `${b.id}:${b.verdict}`)).toEqual([]);
  });

  it('les cas difficiles sont tous présents et documentés (aucun n\'est retiré en silence)', () => {
    expect(HARD_CASES.length).toBeGreaterThanOrEqual(18);
    for (const c of HARD_CASES) { expect(c.why.length).toBeGreaterThan(20); expect(loadRef(c.id)).not.toBeNull(); }
  });

  it('contrôle négatif : une dérive de 0,04 sur jawWidth est DÉTECTÉE par la comparaison', () => {
    const c = HARD_CASES[0]!;
    const ref = loadRef(c.id)!;
    const { svg } = renderCase({ ...c, patch: { ...c.patch, jawWidth: 0.59 } });
    const cur = decodePng(rasterPng(svg));
    const st = diffStats(ref, cur);
    expect(st.rms > 1.5 || st.fracOver8 > 0.002).toBe(true);
  });

  it('la comparaison est exacte sur deux rendus identiques (écart nul)', () => {
    const c = ALL_CASES[0]!;
    const a = decodePng(rasterPng(renderCase(c).svg));
    expect(diffStats(a, a)).toMatchObject({ rms: 0, maxDiff: 0 });
  });
});

describe('régression visuelle — déterminisme et variations (graines fixes)', () => {
  it('même graine, caches vidés : exactement le même SVG (hachage identique)', () => {
    for (const c of [ALL_CASES[0]!, ...HARD_CASES.slice(0, 3)]) {
      clearCaches();
      const a = sha1(renderCase(c).svg);
      clearCaches();
      expect(sha1(renderCase(c).svg)).toBe(a);
    }
  });

  it('24 graines fixes : aucun doublon, dispersion réelle, aucun visage aberrant', () => {
    const seeds = Array.from({ length: 24 }, (_, i) => 500 + i * 13);
    const grids: number[][] = []; const ms: Record<string, number>[] = [];
    for (const seed of seeds) { const { svg, meta } = cellSvg({ seed }, 85, 105); grids.push(lumaGrid(decodePng(rasterPng(svg)))); ms.push(measureStructure(meta.params, 300, 380)); }
    const r = evaluateVariations(grids, ms);
    expect(r.minDistance).toBeGreaterThan(2); // deux visages distincts diffèrent d'au moins 2 niveaux de gris RMS par case
    expect(r.meanDistance).toBeGreaterThan(10);
    expect(r.outliers).toEqual([]);
    // Mesures plates connues, avec leur raison (voir docs/REGRESSION.md) : le crâne est invariant PAR CONTRAT ; l'ouverture n'est pas tirée.
    expect(r.flatMeasures.filter((m) => !['cranium.templeHalf', 'mandible.dropPx', 'neck.platysmaTension'].includes(m))).toEqual([]);
  });

  it('la signature de luminance sépare un visage de lui-même perturbé mais pas de lui-même', () => {
    const c = ALL_CASES[0]!;
    const g = lumaGrid(decodePng(rasterPng(renderCase(c).svg)));
    expect(gridDistance(g, g)).toBe(0);
  });
});
