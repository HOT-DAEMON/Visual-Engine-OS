import { describe, expect, it } from 'vitest';
import { EXTRA_EYE_COUNT, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { EXTRA2_COUNT, NEW2_MIN_DIST, distinctness2, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO_IRIS_FAMILIES, photoIrisFamily } from '../src/generation/eye-iris-families-photo';
import { mulberry32 } from '../src/core/prng';
import { verifyEye } from '../src/verify/eye';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

describe('seconde galerie : 100 formes d’yeux en plus des 48 + 100 existants', () => {
  const rc = extra2Recipes();
  it('100 recettes, 12 enveloppes représentées, graines uniques et hors des deux premières galeries', () => {
    expect(rc).toHaveLength(EXTRA2_COUNT);
    const d = distinctness2(); expect(Object.keys(d.byStyle)).toHaveLength(12);
    for (const n of Object.values(d.byStyle)) expect(n).toBeGreaterThanOrEqual(4);
    const seeds = new Set(rc.map((r) => r.seed)); expect(seeds.size).toBe(100);
    const g1 = new Set([...Array.from({ length: 48 }, (_, i) => 1000 + i * 101), ...extraEyeRecipes().map((r) => r.seed)]);
    for (const s of seeds) expect(g1.has(s)).toBe(false);
  });
  it('deux cases consécutives n’ont jamais la même enveloppe', () => { for (let i = 1; i < rc.length; i++) expect(rc[i]!.style).not.toBe(rc[i - 1]!.style); });
  it('distinction prouvée : distance minimale aux 148 existants ≥ NEW2_MIN_DIST (0,012) et entre les 100 nouveaux ≥ 0,015 (largeur = 1)', () => {
    const d = distinctness2(); expect(d.minToExisting).toBeGreaterThanOrEqual(NEW2_MIN_DIST); expect(d.minAmongNew).toBeGreaterThanOrEqual(0.015);
  });
  it('AUCUN œil existant n’est modifié : la première galerie garde 100 recettes, ses identifiants `extra-i` et ses familles d’iris d’origine', () => {
    expect(extraEyeRecipes()).toHaveLength(EXTRA_EYE_COUNT);
    for (const i of [0, 17, 63, 99]) { const e = generateExtraEye(i) as { id: string }; expect(e.id).toBe(`extra-${i}`); }
  });
  it('déterministe', () => { expect(JSON.stringify(generateExtra2Eye(11))).toBe(JSON.stringify(generateExtra2Eye(11))); });
  it('les 4 familles d’iris photo sont toutes présentes (≥ 8 yeux chacune), et ≈ 30 % des yeux gardent l’iris naturel', () => {
    const by = distinctness2().byFamily;
    for (const f of PHOTO_IRIS_FAMILIES) expect(by[f] ?? 0).toBeGreaterThanOrEqual(8);
    expect(by['naturel']).toBeGreaterThanOrEqual(20); expect(by['naturel']).toBeLessThanOrEqual(45);
  });
  it('la famille est CONSOMMÉE : les couches, la lueur, le limbe et les fibres de l’œil sont ceux de la famille ; l’enveloppe et les canthi sont ceux de la recette', () => {
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const r = rc[i]!; const e = generateExtra2Eye(i) as Record<string, any>;
      expect(e.shape.style).toBe(r.style); expect(e.canthi.inner.roundness).toBe(r.innerRoundness); expect(e.id).toBe(`extra2-${i}`);
      if (r.irisFamily) { const p = photoIrisFamily(r.irisFamily, mulberry32(r.seed ^ 0x2545f491)); expect(e.iris.layers).toEqual(p.layers); expect(e.iris.limbalRing).toBe(p.limbalRing); expect(e.iris.fibers).toBe(p.fibers); expect(e.pupil.deform.squash).toBe(p.pupil.squash); }
    }
  });
  it('les 100 yeux passent verifyEye sans erreur et verifyEyeRender sans échec (géométrie, anatomie, style, règles d’iris)', () => {
    const bad: string[] = [];
    for (let i = 0; i < EXTRA2_COUNT; i++) {
      const e = generateExtra2Eye(i); const v = verifyEye(e as never);
      if (!v.ok) bad.push(`verifyEye ${i}`);
      for (const c of verifyEyeRender(e as never)) if (!c.ok) bad.push(`${i}:${c.id}`);
    }
    expect(bad).toEqual([]);
  }, 120000);
});
