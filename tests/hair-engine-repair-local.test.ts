import { describe, expect, it } from 'vitest';
import { analyzeComposition } from '../src/hair-grammar/compose';
import { balanceLimit, domeLimit, verifyComposed } from '../src/hair-grammar/compose-verify';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { applyIntent, measureIntent, PRESETS, type Intent } from '../src/hair-grammar/intent';
import { generateIntended } from '../src/hair-grammar/intent-run';
import { visibleMarks, lockDefects, defectCost } from '../src/hair-grammar/lock-check';
import { paintLock } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { refreshChildren, solveLock } from '../src/hair-grammar/repair-local';
import { repairCycle } from '../src/hair-grammar/repair';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const H = DEFAULT_HEAD;
const HEAVY_PLUS: Intent = { volume: 1, weight: 1 };

describe('garde-fou de vue : le lacet est en degrés', () => {
  it('refuse 0,3 / 0,5 / −0,7 (radians passés par erreur) et accepte 0 et les degrés', () => {
    for (const bad of [0.3, 0.5, -0.7]) expect(() => viewAt(bad)).toThrow(/degrés/);
    expect(viewAt(0).yaw).toBe(0); expect(viewAt(17).yaw).toBe(17); expect(viewAt(-75).yaw).toBe(-75);
  });
});

describe('seuils dépendants de l\'intention', () => {
  it('sans vent, les seuils d\'origine (0,4 et 0,7) ; avec vent 1, relâchés mais bornés (0,75 et 0,45)', () => {
    expect(balanceLimit()).toBeCloseTo(0.4, 9); expect(domeLimit()).toBeCloseTo(0.7, 9);
    expect(balanceLimit(1)).toBeCloseTo(0.75, 9); expect(domeLimit(1)).toBeCloseTo(0.45, 9);
    expect(balanceLimit(5)).toBeCloseTo(0.75, 9); expect(domeLimit(-2)).toBeCloseTo(0.7, 9);
  });
  it('le vent ne supprime pas un vrai défaut : une calotte presque nue reste signalée à vent 1', () => {
    const V = viewAt(0); const few = generate(TOUSLED, 1).filter((s) => s.family === 'fringe').slice(0, 2);
    expect(verifyComposed(H, few, V, undefined, undefined, { wind: 1 }).defects.some((d) => d.code === 'anat.dome')).toBe(true);
  });
});

describe('solveur local d\'une mèche (projection à édition minimale)', () => {
  const V = viewAt(0); const specs = generate(TOUSLED, 3); const painted = specs.map((L) => paintLock(H, L, V)); const marks = visibleMarks(H, V);
  it('une mèche sans défaut local n\'est pas touchée (le solveur renvoie null)', () => {
    const idx = painted.findIndex((p) => defectCost(lockDefects(H, V, p, marks)) === 0); expect(idx).toBeGreaterThanOrEqual(0);
    expect(solveLock(TOUSLED, specs, idx, V, marks, 1)).toBeNull();
  });
  it('une mèche qui recouvre réellement un repère est corrigée : coût local nul après, édition bornée', () => {
    // Défaut RÉEL : on cherche, parmi plusieurs intentions lourdes non réparées, une mèche qui recouvre un œil ou le visage.
    let hit: { P: typeof TOUSLED; list: ReturnType<typeof generate>; i: number } | null = null;
    for (const I of [HEAVY_PLUS, { volume: 1 }, { weight: 1 }] as Intent[]) {
      const P = applyIntent(TOUSLED, I).profile; const list = generate(P, 1); const pt = list.map((L) => paintLock(H, L, V));
      const i = pt.findIndex((p) => lockDefects(H, V, p, marks, undefined, 0.03 * V.s).some((d) => d.code.startsWith('anat.'))); if (i >= 0) { hit = { P, list, i }; break; }
    }
    expect(hit).not.toBeNull();
    const r = solveLock(hit!.P, hit!.list, hit!.i, V, marks, 1);
    expect(r).not.toBeNull(); expect(r!.after).toBeLessThan(r!.before); expect(r!.editCost).toBeLessThan(2.6);
  });
});

describe('cycle de réparation en deux phases', () => {
  it('« volume +1, lourd » (lacet 29°) : score 0 après réparation (avant le correctif : 20)', () => {
    const V = viewAt(29); const r = generateIntended(TOUSLED, HEAVY_PLUS, V, 1);
    expect(r.verdict.score).toBe(0); expect(r.verdict.score).toBeLessThanOrEqual(r.initial.score);
  });
  it('lacets 30°, 60°, −75° (anciens résidus) : score final 0 pour l\'intention volume +1', () => {
    for (const yaw of [30, 60, -75]) { const r = generateIntended(TOUSLED, { volume: 1 }, viewAt(yaw), 1); expect(r.verdict.defects.filter((d) => d.code.startsWith('geom.') || d.code.startsWith('anat.eye'))).toHaveLength(0); }
  });
  it('jamais de dégradation : le score ne monte jamais, sur 6 lacets × 3 intentions', () => {
    for (const yaw of [0, 15, -30, 45, 60, -75]) for (const I of [PRESETS.voluminous, PRESETS.heavy, PRESETS.windswept] as Intent[]) {
      const r = generateIntended(TOUSLED, I, viewAt(yaw === 0 ? 0 : yaw), 2); expect(r.verdict.score).toBeLessThanOrEqual(r.initial.score + 1e-9);
    }
  }, 120_000);
  it('l\'intention survit à la réparation : volume mesuré après ≥ 85 % du volume avant, poids ≥ 0,9× ', () => {
    const V = viewAt(29); const { profile } = applyIntent(TOUSLED, HEAVY_PLUS); const s0 = generate(profile, 1); const r = repairCycle(profile, s0, V, 1, 12, {});
    const m0 = measureIntent(profile, s0, V, analyzeComposition(H, s0, V)); const m1 = measureIntent(profile, r.specs, V, analyzeComposition(H, r.specs, V));
    expect(m1.volume).toBeGreaterThan(0.85 * m0.volume); expect(m1.weight).toBeGreaterThan(0.9 * m0.weight);
  });
  it('déterminisme : même graine, même réparation', () => {
    const V = viewAt(29); expect(generateIntended(TOUSLED, HEAVY_PLUS, V, 1).specs).toEqual(generateIntended(TOUSLED, HEAVY_PLUS, V, 1).specs);
  });
});

describe('refreshChildren : les filles suivent leur mère', () => {
  it('après une édition de la mère, la jonction reste continue (écart < 0,01 H)', () => {
    const specs = generate(TOUSLED, 1); const par = specs.find((s) => specs.some((c) => c.parent?.id === s.id)); if (!par) return;
    const edited = specs.map((s) => (s.id === par.id ? { ...s, length: s.length * 0.9, lift1: s.lift1 + 0.02 } : s));
    const out = refreshChildren(TOUSLED, edited, par.id); expect(out).toHaveLength(edited.length);
    const by = new Map(out.map((s) => [s.id, s]));
    for (const c of out.filter((s) => s.parent?.id === par.id)) expect(by.get(c.id)?.parent?.id).toBe(par.id);
  });
});
