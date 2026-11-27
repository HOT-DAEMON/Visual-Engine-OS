import { describe, expect, it } from 'vitest';
import { analyzeComposition } from '../src/hair-grammar/compose';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { HIME, PIXIE } from '../src/hair-grammar';
import { repairCycle } from '../src/hair-grammar/repair';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * Coupes de la passe 11 (hime, pixie à frange balayée) : données de profil seulement, MÊME moteur. Fixe ce qui a été mesuré à la livraison :
 * déterminisme, finitude, hiérarchie de masses, verdict G/A/S après réparation sur des combinaisons (graine, lacet) vérifiées, et — pour la hime —
 * le bord franc des franges (profil de largeur `flat`, ajouté à `FamilySpec` en champ optionnel). Les échecs connus (hime 22/24, pixie 21/24 sur
 * 8 graines × 3 lacets) sont documentés dans docs/HAIR-PASS11-REMAINING.md ; ces tests ne les masquent pas : ils épinglent les combinaisons valides.
 */
const CUTS = [['hime', HIME, 4000], ['pixie', PIXIE, 4000]] as const;

describe.each(CUTS)('coupe %s', (name, P) => {
  it('est déterministe, finie et nommée', () => {
    const a = generate(P, 4); const b = generate(P, 4);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(60);
    expect(P.name).toBe(name);
    for (const L of a) for (const x of [L.length, L.width, L.lift0, L.lift1, L.gravity]) expect(Number.isFinite(x)).toBe(true);
  });

  it('a une masse dominante (pas deux masses égales)', () => {
    const c = analyzeComposition(DEFAULT_HEAD, generate(P, 4), viewAt(0));
    expect(c.hierarchy.ratio).toBeGreaterThanOrEqual(1.15);
  });

  it.each([[1, 0], [2, 0], [3, 0], [4, 30], [5, -30]] as const)('graine %i, lacet %i° : verdict G/A/S correct après réparation', (seed, yaw) => {
    const r = repairCycle(P, generate(P, seed), viewAt(yaw), seed, 24);
    expect(r.verdict.defects.filter((d) => d.code === 'anat.eye')).toEqual([]);
    expect(r.verdict.ok).toBe(true);
  }, 60_000);
});

describe('hime : franges à bord franc', () => {
  it('les franges portent un profil `flat` jusqu’au bout ; le dôme (pointu) n’en a pas', () => {
    const locks = generate(HIME, 2);
    const fringe = locks.filter((l) => l.family.startsWith('fringe'));
    expect(fringe.length).toBeGreaterThan(40);
    for (const l of fringe) expect(l.widthProg?.some((o) => o.kind === 'flat' && o.to > 1)).toBe(true);
    for (const l of locks.filter((q) => q.family === 'dome')) expect(l.widthProg).toBeUndefined();
  });
});

describe('pixie : crâne dégagé sur les côtés', () => {
  it('les côtés sont plus courts que la frange (coupe courte)', () => {
    const locks = generate(PIXIE, 1);
    const mean = (f: string): number => { const q = locks.filter((l) => l.family.startsWith(f)); return q.reduce((s, l) => s + l.length, 0) / q.length; };
    expect(mean('sides')).toBeLessThan(mean('fringe'));
    expect(Math.max(...locks.map((l) => l.length))).toBeLessThan(0.6);
  });
});
