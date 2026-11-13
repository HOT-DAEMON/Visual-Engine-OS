import { describe, expect, it } from 'vitest';
import { EXTRA_EYE_COUNT, distinctness, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { verifyEye } from '../src/verify/eye';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

describe('galerie étendue : 100 formes d’yeux en plus des 48', () => {
  const rc = extraEyeRecipes();
  it('100 recettes, 12 enveloppes représentées (≥ 8 chacune), graines uniques hors des 48 existantes', () => {
    expect(rc).toHaveLength(EXTRA_EYE_COUNT);
    const by = distinctness().byStyle;
    expect(Object.keys(by)).toHaveLength(12);
    for (const n of Object.values(by)) expect(n).toBeGreaterThanOrEqual(8);
    const seeds = new Set(rc.map((r) => r.seed)); expect(seeds.size).toBe(100);
    const existing = new Set(Array.from({ length: 48 }, (_, i) => 1000 + i * 101));
    for (const s of seeds) expect(existing.has(s)).toBe(false);
  });
  it('deux cases consécutives n’ont jamais la même enveloppe (entrelacement)', () => { for (let i = 1; i < rc.length; i++) expect(rc[i]!.style).not.toBe(rc[i - 1]!.style); });
  it('distinction prouvée : distance minimale aux 48 existants ≥ 0,02 et entre les 100 ≥ 0,009 (largeur = 1)', () => {
    const d = distinctness(); expect(d.minToExisting).toBeGreaterThanOrEqual(0.02); expect(d.minAmongNew).toBeGreaterThanOrEqual(0.009);
  });
  it('déterministe', () => { expect(JSON.stringify(generateExtraEye(7))).toBe(JSON.stringify(generateExtraEye(7))); });
  it('la recette est CONSOMMÉE : style, inclinaison, fraction haute et rondeurs des canthi se retrouvent dans l’œil', () => {
    for (const i of [0, 13, 42, 99]) { const e = generateExtraEye(i) as any; const r = rc[i]!; expect(e.shape.style).toBe(r.style); expect(e.shape.tiltDeg).toBeCloseTo(r.tiltDeg, 9); expect(e.shape.upperFraction).toBeCloseTo(r.upperFraction, 9); expect(e.canthi.inner.roundness).toBeCloseTo(r.innerRoundness, 9); expect(e.canthi.outer.roundness).toBeCloseTo(r.outerRoundness, 9); }
  });
  it('les 100 yeux passent verifyEye sans erreur (géométrie, anatomie, style, enveloppe)', () => {
    const bad: string[] = [];
    for (let i = 0; i < 100; i++) { const r = verifyEye(generateExtraEye(i) as never); if (!r.ok) bad.push(`${i}:${r.failures.map((f) => f.id).join(',')}`); }
    expect(bad).toEqual([]);
  }, 120000);
  it('rendu : les 100 yeux passent la vérification sur pixels (géométrie, anatomie, style)', () => {
    const bad: string[] = [];
    for (let i = 0; i < 100; i++) for (const c of verifyEyeRender(generateExtraEye(i) as never)) if (!c.ok) bad.push(`${i}:${c.id}(${c.value}/${c.limit})`);
    expect(bad).toEqual([]);
  }, 240000);
});
