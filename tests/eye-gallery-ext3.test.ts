import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EXTRA_EYE_COUNT, dist, existingVectors, existingVectorsTrue, extraEyeRecipes } from '../src/generation/eye-gallery-ext';
import { LEGACY_EXISTING_VECTORS } from '../src/generation/eye-existing-vectors-legacy';
import { extra2Recipes, vectorOf } from '../src/generation/eye-gallery-ext2';
import { EXTRA3_COUNT, NEW3_MIN_DIST, distinctness3, extra3Recipes, generateExtra3Eye } from '../src/generation/eye-gallery-ext3';
import { PHOTO2_IRIS_FAMILIES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { EXTENDED2_IDENTITIES, EXTENDED3_IDENTITIES, extended3Pair } from '../src/generation/eye-pool';
import { generateRandomFace } from '../src/generation/random-face';
import { mulberry32 } from '../src/core/prng';
import { verifyEye } from '../src/verify/eye';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

describe('troisième galerie : 100 formes d’yeux en plus des 48 + 100 + 100 existants', () => {
  const rc = extra3Recipes();
  it('100 recettes, 12 enveloppes représentées, graines uniques et hors des galeries 1 et 2', () => {
    expect(rc).toHaveLength(EXTRA3_COUNT);
    const d = distinctness3(); expect(Object.keys(d.byStyle)).toHaveLength(12);
    for (const n of Object.values(d.byStyle)) expect(n).toBeGreaterThanOrEqual(2);
    const seeds = new Set(rc.map((r) => r.seed)); expect(seeds.size).toBe(100);
    const old = new Set([...Array.from({ length: 48 }, (_, i) => 1000 + i * 101), ...extraEyeRecipes().map((r) => r.seed), ...extra2Recipes().map((r) => r.seed)]);
    for (const s of seeds) expect(old.has(s)).toBe(false);
  });
  it('deux cases consécutives n’ont jamais la même enveloppe', () => { for (let i = 1; i < rc.length; i++) expect(rc[i]!.style).not.toBe(rc[i - 1]!.style); });
  it('distinction prouvée : distance minimale aux 248 existants ≥ NEW3_MIN_DIST (0,009) et entre les 100 nouveaux ≥ 0,015 (largeur = 1)', () => {
    const d = distinctness3(); expect(d.minToExisting).toBeGreaterThanOrEqual(NEW3_MIN_DIST); expect(d.minAmongNew).toBeGreaterThanOrEqual(0.015);
  });
  it('AUCUN œil existant n’est modifié : recettes des galeries 1 et 2 inchangées (empreinte), identifiants extra-i / extra2-i conservés', () => {
    expect(extraEyeRecipes()).toHaveLength(EXTRA_EYE_COUNT);
    expect(createHash('sha1').update(JSON.stringify(extraEyeRecipes())).digest('hex')).toBe('28571347744465ccc202c19245ce5f3227150f8d');   // empreintes d'AVANT la passe 10
    expect(createHash('sha1').update(JSON.stringify(extra2Recipes())).digest('hex')).toBe('7cb6ed3b2838f132680b86c37e9e2a5cfbdfc56e');
    expect((generateExtra3Eye(5) as { id: string }).id).toBe('extra3-5');
  });
  it('déterministe', () => { expect(JSON.stringify(generateExtra3Eye(11))).toBe(JSON.stringify(generateExtra3Eye(11))); });
  it('les 5 familles d’iris photo 2 sont toutes présentes (≥ 8 yeux chacune) ; ≈ 20 % des yeux gardent l’iris naturel', () => {
    const by = distinctness3().byFamily;
    for (const f of PHOTO2_IRIS_FAMILIES) expect(by[f] ?? 0).toBeGreaterThanOrEqual(8);
    expect(by['naturel']).toBeGreaterThanOrEqual(8); expect(by['naturel']).toBeLessThanOrEqual(35);
  });
  it('la famille est CONSOMMÉE : couches, matériau de base, limbe, fibres et pupille sont ceux de la famille ; enveloppe et canthi ceux de la recette', () => {
    for (let i = 0; i < 12; i++) {
      const r = rc[i]!; const e = generateExtra3Eye(i) as Record<string, any>;
      expect(e.shape.style).toBe(r.style); expect(e.canthi.inner.roundness).toBe(r.innerRoundness);
      if (r.irisFamily) { const p = photoIrisFamily2(r.irisFamily, mulberry32(r.seed ^ 0x2545f491)); expect(e.iris.layers).toEqual(p.layers); expect(e.iris.material.base.stops).toEqual(p.base); expect(e.iris.limbalRing).toBe(p.limbalRing); expect(e.iris.fibers).toBe(p.fibers); expect(e.pupil.deform.squash).toBe(p.pupil.squash); }
    }
  });
  it('les 100 yeux passent verifyEye sans erreur et verifyEyeRender sans échec (géométrie, anatomie, style, règles d’iris)', () => {
    const bad: string[] = [];
    for (let i = 0; i < EXTRA3_COUNT; i++) {
      const e = generateExtra3Eye(i); if (!verifyEye(e as never).ok) bad.push(`verifyEye ${i}`);
      for (const c of verifyEyeRender(e as never)) if (!c.ok) bad.push(`${i}:${c.id}`);
    }
    expect(bad).toEqual([]);
  }, 180000);
});

describe('vecteurs des yeux d’origine : figés (galeries 1 et 2) / corrects (galerie 3)', () => {
  it('48 vecteurs figés ; les 32 yeux non gauches ont le même vecteur figé et recalculé, les 16 yeux gauches ont un vrai profil différent', () => {
    expect(LEGACY_EXISTING_VECTORS).toHaveLength(48); const T = existingVectorsTrue(); const L = existingVectors(); let same = 0; let diff = 0;
    T.forEach((v, i) => { if (dist(v, L[i] as number[]) < 1e-9) same++; else diff++; });
    expect(same).toBe(32); expect(diff).toBe(16);
  });
  it('la distinction annoncée tient avec les VRAIS profils : galerie 1 ≥ 0,018, galerie 2 ≥ 0,012 aux 48 yeux d’origine corrigés', () => {
    const T = existingVectorsTrue(); const min = (rs: readonly { seed: number }[], f: (r: never) => number[]): number => Math.min(...rs.flatMap((r) => T.map((t) => dist(f(r as never), t))));
    expect(min(extraEyeRecipes(), vectorOf as never)).toBeGreaterThanOrEqual(0.018); expect(min(extra2Recipes(), vectorOf as never)).toBeGreaterThanOrEqual(0.012);
  });
});

describe('visage : eyeSource « extended3 » (348 identités)', () => {
  it('348 identités : les 248 premières sont celles d’extended2, les 100 suivantes viennent de la galerie 3 ; hors plage refusé', () => {
    expect(EXTENDED3_IDENTITIES).toBe(EXTENDED2_IDENTITIES + 100); expect(EXTENDED3_IDENTITIES).toBe(348);
    expect(() => extended3Pair(348)).toThrow(RangeError); expect(() => extended3Pair(-1)).toThrow(RangeError);
    expect((extended3Pair(300).left as { id: string }).id).toBe('extra3-52');
  });
  it('generateRandomFace(extended3, identité 300) : œil de la galerie 3 sur les deux côtés, déterministe ; les sources existantes gardent leurs tirages', () => {
    const f1 = JSON.stringify(generateRandomFace(5, { eyeSource: 'extended3', identity: 300 } as never)); const f2 = JSON.stringify(generateRandomFace(5, { eyeSource: 'extended3', identity: 300 } as never));
    expect(f1).toBe(f2); expect(f1).toContain('"extra3-52"'.slice(1, -1)) ;
    // Passe 14 : l'invariant est « les sources existantes gardent leurs TIRAGES » (quel œil, quelle enveloppe, sur 4 graines), pas le JSON complet du visage :
    // celui-ci change dès qu'un paramètre est ajouté ailleurs (oreille, iris) et avait rendu le test périmé. Signature identique à la passe 10 (commit 4dc0d14), vérifiée.
    const eyesOf = (o: unknown, out: { id: string; shape?: { style?: string } }[] = []): { id: string; shape?: { style?: string } }[] => {
      if (Array.isArray(o)) o.forEach((x) => eyesOf(x, out));
      else if (o && typeof o === 'object') { if ((o as { kind?: string }).kind === 'eye') out.push(o as never); for (const v of Object.values(o)) eyesOf(v, out); }
      return out;
    };
    const h = (src: 'gallery' | 'extended' | 'extended2'): string => createHash('sha1').update([42, 7, 1234, 99].map((seed) => eyesOf(generateRandomFace(seed, { eyeSource: src } as never)).map((e) => `${e.id}|${e.shape?.style ?? '?'}`).join(',')).join(';')).digest('hex').slice(0, 12);
    expect([h('gallery'), h('extended'), h('extended2')]).toEqual(['1689f5fd870d', 'b9c327bf952a', '4da88f930425']);
  });
});
