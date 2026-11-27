import { describe, expect, it } from 'vitest';
import { analyzeComposition } from '../src/hair-grammar/compose';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { BOB, SHAG } from '../src/hair-grammar';
import { repairCycle } from '../src/hair-grammar/repair';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * Nouvelles coupes de la passe 10 (carré, shag) : données de profil seulement, MÊME moteur (générateur, peinture, solveur de réparation,
 * vérification G/A/S). Ces tests fixent ce qui a été mesuré à la livraison : déterminisme, finitude, présence d'une famille `back`
 * (exemptée du contrôle « œil recouvert » par le moteur), hiérarchie de masses (calotte dominante) et verdict G/A/S après réparation.
 */
const CUTS = [['bob', BOB], ['shag', SHAG]] as const;

describe.each(CUTS)('coupe %s', (name, P) => {
  it('est déterministe et finie', () => {
    const a = generate(P, 4); const b = generate(P, 4);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(55);
    for (const L of a) for (const x of [L.length, L.width, L.lift0, L.lift1, L.gravity]) expect(Number.isFinite(x)).toBe(true);
  });

  it('porte une famille `back` et une calotte `mass` plus fournie', () => {
    const fam: Record<string, number> = {}; for (const s of generate(P, 4)) fam[s.family] = (fam[s.family] ?? 0) + 1;
    expect(fam.back).toBeGreaterThan(0);
    expect(fam.mass).toBeGreaterThan(fam.back as number);
    expect(P.name).toBe(name);
  });

  it('a une masse dominante (calotte), pas deux masses égales', () => {
    const v = viewAt(0); const c = analyzeComposition(DEFAULT_HEAD, generate(P, 4), v);
    expect(c.hierarchy.ratio).toBeGreaterThanOrEqual(1.15);
    expect(c.masses[0]?.family).toBe('mass');
  });

  it.each([[1, 0], [2, 30], [3, -30]] as const)('graine %i, lacet %i° : verdict G/A/S correct après réparation', (seed, yaw) => {
    const v = viewAt(yaw); const r = repairCycle(P, generate(P, seed), v, seed, 24);
    expect(r.verdict.defects.filter((d) => d.code === 'anat.eye')).toEqual([]);
    expect(r.verdict.ok).toBe(true);
  }, 60_000);
});
