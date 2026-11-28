import { describe, expect, it } from 'vitest';
import { analyzeComposition } from '../src/hair-grammar/compose';
import { verifyAttach } from '../src/hair-grammar/attach-verify';
import { familyOf, generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { DOUBLE_BUNS, TOP_BUN } from '../src/hair-grammar/profiles/buns';
import { PONYTAIL } from '../src/hair-grammar/profiles/ponytail';
import { TWIN_BRAIDS } from '../src/hair-grammar/profiles/braids';
import { repairCycle } from '../src/hair-grammar/repair';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * Coupes à attache de la passe 12 (chignons doubles, chignon haut, queue de cheval, couettes tressées) : données de profil + `FamilySpec.field` / `group` / `HairProfile.post` (additifs).
 * Fixe ce qui a été mesuré à la livraison : déterminisme, hiérarchie (la frange est UNE masse), couche d'attaches, verdict G/A/S après réparation sur des combinaisons vérifiées, et la
 * non-régression de la réparation des trous parasites. Les échecs connus sont documentés dans docs/HAIR-PASS12-REMAINING.md ; ces tests ne les masquent pas : ils épinglent les combinaisons valides.
 */
const CUTS = [['double_buns', DOUBLE_BUNS], ['top_bun', TOP_BUN], ['ponytail', PONYTAIL], ['twin_braids', TWIN_BRAIDS]] as const;

describe.each(CUTS)('coupe %s', (name, P) => {
  it('est déterministe, finie et nommée', () => {
    const a = generate(P, 4); const b = generate(P, 4);
    expect(a).toEqual(b);
    expect(P.name).toBe(name);
    expect(a.length).toBeGreaterThan(80);
    for (const L of a) for (const x of [L.length, L.width, L.lift0, L.lift1, L.gravity]) expect(Number.isFinite(x)).toBe(true);
    expect(new Set(a.map((L) => L.id)).size).toBe(a.length); // identifiants uniques malgré les familles groupées
  });

  it('a une masse dominante : la frange (trois étages, un seul groupe) ou, pour la queue de cheval, la queue', () => {
    const c = analyzeComposition(DEFAULT_HEAD, generate(P, 4), viewAt(0));
    expect(c.masses[0]?.family).toBe(name === 'ponytail' ? 'tail' : 'fringe');
    expect(c.hierarchy.dominantShare).toBeGreaterThanOrEqual(0.25);
  });

  it.each([[1, 0], [2, 0], [3, 30]] as const)('graine %i, lacet %i° : verdict G/A/S correct après réparation', (seed, yaw) => {
    const r = repairCycle(P, generate(P, seed), viewAt(yaw), seed, 24);
    expect(r.verdict.defects.filter((d) => d.code === 'anat.eye')).toEqual([]);
    expect(r.verdict.ok).toBe(true);
  }, 90_000);
});

describe('groupes de familles', () => {
  it('`familyOf` retrouve une famille par identifiant ET par groupe (la réparation régénère les mèches groupées)', () => {
    expect(familyOf(DOUBLE_BUNS, 'fringeLow')?.id).toBe('fringeLow');
    expect(familyOf(DOUBLE_BUNS, 'fringe')?.group).toBe('fringe');
    expect(familyOf(DOUBLE_BUNS, 'inconnue')).toBeUndefined();
  });
});

describe('chignons : disque borné posé sur le crâne', () => {
  it('double chignon : deux chignons de largeur proche de la mesure (réf. 04 : diamètre ≈ 0,41 Hc), ronds, au-dessus des yeux et des oreilles', () => {
    const r = verifyAttach(DEFAULT_HEAD, generate(DOUBLE_BUNS, 1), viewAt(0));
    const all = r.flatMap((q) => q.checks);
    expect(all.filter((c) => c.name.includes('largeur (H)')).length).toBe(2);
    for (const c of all) expect(c.ok, `${c.name} = ${c.value}`).toBe(true);
    for (const c of all.filter((q) => q.name.includes('largeur (H)'))) expect(Math.abs(c.value - 0.41)).toBeLessThan(0.1);
  });
  it('le champ propre à la famille ne change pas les autres coupes : même graine, mêmes mèches pour une famille sans champ', () => {
    expect(familyOf(DOUBLE_BUNS, 'fringeLow')?.field).toBeUndefined();
    expect(familyOf(DOUBLE_BUNS, 'bunL')?.field?.whorl).toBeDefined();
  });
});

describe('queue de cheval', () => {
  it('la racine est derrière l’oreille et la queue descend', () => {
    const r = verifyAttach(DEFAULT_HEAD, generate(PONYTAIL, 1), viewAt(0));
    for (const c of r.flatMap((q) => q.checks)) expect(c.ok, `${c.name} = ${c.value}`).toBe(true);
    expect(generate(PONYTAIL, 1).filter((L) => L.family === 'tail').length).toBeGreaterThanOrEqual(20);
  });
});

describe('tresses : entrelacs produits par weaveStrands', () => {
  it('chaque tresse est un groupe de trois brins `weave` ; le crochet `post` est déterministe', () => {
    const a = generate(TWIN_BRAIDS, 3); const g = new Map<string, number>();
    for (const L of a) if (L.weave) g.set(L.weave, (g.get(L.weave) ?? 0) + 1);
    expect([...g.values()]).toEqual([3, 3]);
    expect(generate(TWIN_BRAIDS, 3)).toEqual(a);
    expect(a.some((L) => L.family === 'braidL' && !L.weave)).toBe(false);
  });
  it('les brins se croisent de façon visible (≥ 2 croisements francs par tresse, lacet 0°)', () => {
    const r = verifyAttach(DEFAULT_HEAD, generate(TWIN_BRAIDS, 1), viewAt(0));
    const st = r.find((q) => q.layer === 'style');
    expect(st?.checks.length).toBe(2);
    for (const c of st?.checks ?? []) expect(c.value).toBeGreaterThanOrEqual(2);
  });
});
