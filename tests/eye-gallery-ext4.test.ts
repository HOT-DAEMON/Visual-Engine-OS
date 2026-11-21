import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extraEyeRecipes } from '../src/generation/eye-gallery-ext';
import { extra2Recipes } from '../src/generation/eye-gallery-ext2';
import { extra3Recipes } from '../src/generation/eye-gallery-ext3';
import { ALMOND_ANCHORS, EXTRA4_COUNT, LOWER_PEAK_RANGE, NEW4_MIN_DIST, distinctness4, extra4Recipes, generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { EXTENDED3_IDENTITIES, EXTENDED4_IDENTITIES, extended4Pair } from '../src/generation/eye-pool';
import { generateRandomFace } from '../src/generation/random-face';
import { verifyEye } from '../src/verify/eye';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

describe('quatrième galerie (passe 11) : 100 yeux, nouvelles enveloppes (domaine mesuré réfs 13/17), lowerPeak branché', () => {
  const rc = extra4Recipes();
  it('100 recettes, 10 enveloppes représentées dont almond (ancres mesurées), graines hors des galeries 1 à 3', () => {
    expect(rc).toHaveLength(EXTRA4_COUNT);
    const d = distinctness4(); expect(Object.keys(d.byStyle)).toContain('almond'); expect(Object.keys(d.byStyle).length).toBeGreaterThanOrEqual(9);
    const seeds = new Set(rc.map((r) => r.seed)); expect(seeds.size).toBe(100);
    const old = new Set([...extraEyeRecipes().map((r) => r.seed), ...extra2Recipes().map((r) => r.seed), ...extra3Recipes().map((r) => r.seed)]);
    for (const s of seeds) expect(old.has(s)).toBe(false);
  });
  it('distinction prouvée : ≥ NEW4_MIN_DIST aux 348 profils existants et ≥ 0,01 entre les nouveaux (le profil inclut lowerPeak)', () => {
    const d = distinctness4(); expect(d.minToExisting).toBeGreaterThanOrEqual(NEW4_MIN_DIST); expect(d.minAmongNew).toBeGreaterThanOrEqual(0.01);
  });
  it('nouvelles enveloppes : le domaine d’aspect et d’inclinaison dépasse celui des galeries 1 à 3 (inclinaison −5…14, aspect 0,44…0,70 hors losanges)', () => {
    const d = distinctness4(); expect(d.tiltDeg[0]).toBeLessThan(-8); expect(d.tiltDeg[1]).toBeGreaterThan(15); expect(d.aspect[1]).toBeGreaterThan(0.72);
  });
  it('lowerPeak : renseigné sur les 100 recettes, dans la plage mesurée 0,40–0,65, et CONSOMMÉ par l’œil construit', () => {
    for (const r of rc) { expect(r.lowerPeak).toBeGreaterThanOrEqual(LOWER_PEAK_RANGE[0]); expect(r.lowerPeak).toBeLessThanOrEqual(LOWER_PEAK_RANGE[1]); }
    for (const i of [0, 17, 63]) expect((generateExtra4Eye(i) as any).shape.lowerPeak).toBeCloseTo(rc[i]!.lowerPeak as number, 10);
  });
  it('les galeries 1 à 3 n’ont AUCUN lowerPeak : leurs yeux ne changent pas', () => {
    expect(extraEyeRecipes().every((r) => r.lowerPeak === undefined)).toBe(true); expect(extra2Recipes().every((r) => r.lowerPeak === undefined)).toBe(true); expect(extra3Recipes().every((r) => r.lowerPeak === undefined)).toBe(true);
    expect(createHash('sha1').update(JSON.stringify(extraEyeRecipes())).digest('hex')).toBe('28571347744465ccc202c19245ce5f3227150f8d');
    expect(createHash('sha1').update(JSON.stringify(extra2Recipes())).digest('hex')).toBe('7cb6ed3b2838f132680b86c37e9e2a5cfbdfc56e');
  });
  it('ancres almond : identiques aux mesures de references/eyes/measures.json', () => {
    const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { aspect: number; upperFraction: number; tiltDeg: number }>;
    for (const a of ALMOND_ANCHORS) { const m = M[a.id]!; expect(a.aspect).toBeCloseTo(m.aspect, 3); expect(a.upperFraction).toBeCloseTo(m.upperFraction, 3); expect(a.tiltDeg).toBeCloseTo(m.tiltDeg, 2); }
  });
  it('déterministe ; les 100 yeux passent verifyEye et verifyEyeRender (géométrie, anatomie, style)', () => {
    expect(JSON.stringify(generateExtra4Eye(11))).toBe(JSON.stringify(generateExtra4Eye(11)));
    for (let i = 0; i < EXTRA4_COUNT; i++) {
      const e = generateExtra4Eye(i) as never; expect(verifyEye(e).ok, `verifyEye ${i}`).toBe(true);
      const bad = ((verifyEyeRender(e) as any).checks ?? verifyEyeRender(e)).filter((c: any) => !c.ok); expect(bad.map((c: any) => c.id), `pixels ${i}`).toEqual([]);
    }
  }, 120000);
  it('eyeSource "extended4" : 448 identités, identités ≤ 347 inchangées, ≥ 348 portent lowerPeak, miroir gauche / droite', () => {
    expect(EXTENDED4_IDENTITIES).toBe(448); expect(() => extended4Pair(448)).toThrow();
    const a = generateRandomFace(9, { eyeSource: 'extended4', identity: 5 }); const b = generateRandomFace(9, { eyeSource: 'extended3', identity: 5 }); expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const p = extended4Pair(EXTENDED3_IDENTITIES + 3); expect((p.left as any).shape.lowerPeak).toBe((p.right as any).shape.lowerPeak); expect((p.left as any).shape.outerSide).toBe('left'); expect((p.right as any).shape.outerSide).toBe('right');
  });
  it('generateRandomFace({ eyeLowerPeak }) : nombre imposé aux deux yeux, "auto" tiré dans la plage mesurée et déterministe ; absent : visage inchangé', () => {
    const eyes = (f: any): any[] => f.objects.filter((o: any) => o.kind === 'eye');
    const f = generateRandomFace(21, { eyeLowerPeak: 0.5 }); for (const e of eyes(f)) expect(e.shape.lowerPeak).toBe(0.5);
    const g = generateRandomFace(21, { eyeLowerPeak: 'auto' }); const v = eyes(g)[0].shape.lowerPeak; expect(v).toBeGreaterThanOrEqual(0.4); expect(v).toBeLessThanOrEqual(0.65); expect(JSON.stringify(g)).toBe(JSON.stringify(generateRandomFace(21, { eyeLowerPeak: 'auto' })));
    expect(JSON.stringify(generateRandomFace(21, {}))).toBe(JSON.stringify(generateRandomFace(21)));
    for (const e of eyes(generateRandomFace(21))) expect(e.shape.lowerPeak).toBeUndefined();
  });
});
