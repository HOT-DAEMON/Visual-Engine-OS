import { describe, expect, it } from 'vitest';
import { bladeOutline } from '../src/hair-grammar/blade';
import { fillPoly, makeGrid } from '../src/hair-grammar/compose-grid';
import { paintLock } from '../src/hair-grammar/paint';
import { domeLimit, verifyComposed } from '../src/hair-grammar/compose-verify';
import { domeMask, domeRatio } from '../src/hair-grammar/dome';
import { generate } from '../src/hair-grammar/grammar';
import { applyIntent, PRESETS } from '../src/hair-grammar/intent';
import { orderStability, type Stability } from '../src/hair-grammar/occlusion-stability';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { generateIntended } from '../src/hair-grammar/intent-run';
import type { Intent } from '../src/hair-grammar/intent';
import type { LockSpec } from '../src/hair-grammar/lock';
import { partCorridor } from '../src/hair-grammar/repair-dome';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const H = DEFAULT_HEAD;
const CV = 'variété des largeurs (CV, mèches racines)';
const KIDS = 'filles plus fines que leur mère (largeur / mère, max)';
const cv = (specs: readonly LockSpec[]): number => verifyComposed(H, specs, viewAt(0)).reports.flatMap((r) => r.checks).find((c) => c.name === CV)?.value ?? NaN;
const check = (specs: readonly LockSpec[], name: string) => verifyComposed(H, specs, viewAt(0)).reports.flatMap((r) => r.checks).find((c) => c.name === name);

describe('variété des largeurs : mesurée sur les mèches racines', () => {
  const specs = generate(TOUSLED, 2);
  it('sans filles, la valeur est celle de toutes les mèches (inchangée)', () => {
    expect(specs.some((s) => s.parent)).toBe(false); expect(cv(specs)).toBeGreaterThan(0.1);
  });
  it('des filles (pointes) ne font pas varier la mesure : seule la population racine compte', () => {
    const base = specs[0]!; const kids: LockSpec[] = [0, 1, 2].map((i) => ({ ...base, id: `kid${i}`, width: base.width * 0.16, parent: { id: base.id, t: 0.8 + i * 0.05, kind: 'fray' } } as LockSpec));
    expect(cv([...specs, ...kids])).toBeCloseTo(cv(specs), 9);
  });
  it('des largeurs uniformes échouent toujours (< 0,1), des largeurs chaotiques aussi (> 0,9)', () => {
    const uni = specs.map((s) => ({ ...s, width: 0.05 })); expect(check(uni, CV)?.ok).toBe(false);
    const wild = specs.map((s, i) => ({ ...s, width: i % 5 === 0 ? 0.6 : 0.01 })); expect(check(wild, CV)?.ok).toBe(false);
  });
  it('une fille plus large que sa mère est signalée', () => {
    const base = specs[0]!; const kid = { ...base, id: 'fat', width: base.width * 1.5, parent: { id: base.id, t: 0.8, kind: 'fray' } } as LockSpec;
    expect(check([...specs, kid], KIDS)?.ok).toBe(false); expect(check(specs, KIDS)?.ok).toBe(true);
  });
});

describe('remplissage de calotte (phase 3 du cycle de réparation)', () => {
  const I: Intent = { volume: 0.6, fringe: 0.5, part: -0.3, tips: 0.5, weight: 0.3 };
  it('l\'intention combinée passe le style à tous les lacets sans seuil relâché', () => {
    for (const yaw of [-60, -30, 0, 30, 60]) {
      const r = generateIntended(TOUSLED, I, viewAt(yaw), 2);
      expect(r.verdict.reports.find((x) => x.layer === 'style')?.ok ?? true).toBe(true);
    }
  });
  it('à 30°, la calotte atteint le seuil (non modifié : 0,70) et le score ne monte jamais', () => {
    const r = generateIntended(TOUSLED, I, viewAt(30), 2); const g = r.verdict.composition.grid;
    expect(domeRatio(domeMask(r.profile.head, viewAt(30), g), g)).toBeGreaterThanOrEqual(domeLimit());
    expect(r.verdict.score).toBeLessThanOrEqual(r.initial.score);
    expect(r.verdict.defects.some((d) => d.code === 'anat.dome')).toBe(false);
  });
  it('chaque mèche ajoutée est journalisée, sans défaut d\'œil / visage / géométrie, et le couloir de la raie reste libre', () => {
    const r = generateIntended(TOUSLED, { part: -0.3 }, viewAt(0), 4); const added = r.specs.filter((s) => /-dome\d/.test(s.id));
    expect(r.journal.filter((j) => j.code === 'anat.dome' && j.kept).length).toBe(added.length);
    const bad = (v: typeof r.verdict): number => v.defects.filter((d) => /^(geom|eye|face)/.test(d.code)).length;
    expect(bad(r.verdict)).toBeLessThanOrEqual(bad(r.initial));
    const V = viewAt(0); const g = r.verdict.composition.grid; const cor = partCorridor(r.profile, V, -0.3 * r.profile.head.rx, g); const mask = domeMask(r.profile.head, V, g);
    // Propriété par construction : la lame d'une mèche ajoutée ne recouvre aucune cellule du couloir (dans la calotte).
    for (const s of added) {
      const T = makeGrid(g.nx * g.cell, g.ny * g.cell, g.cell); fillPoly(T, bladeOutline(paintLock(r.profile.head, s, V).blade), 1);
      expect(T.data.some((c, i) => c && cor[i] && mask[i])).toBe(false);
    }
    expect(cor.some((c, i) => c && mask[i])).toBe(true);
  });
  it('déterministe : deux exécutions donnent les mêmes mèches', () => {
    const a = generateIntended(TOUSLED, I, viewAt(30), 2); const b = generateIntended(TOUSLED, I, viewAt(30), 2);
    expect(a.specs.map((s) => s.id)).toEqual(b.specs.map((s) => s.id)); expect(a.verdict.score).toBe(b.verdict.score);
  });
  it('sans raie ni défaut de calotte, la phase 3 ne s\'exécute pas', () => {
    const r = generateIntended(TOUSLED, {}, viewAt(0), 1); expect(r.journal.filter((j) => j.code === 'anat.dome').length).toBe(0);
  });
});

describe('fiabilité de l\'ordre de profondeur : mesure par tronçon (ce que le rendu consomme)', () => {
  const cases: { plan: Stability; vol: Stability }[] = [];
  for (const I of [{}, PRESETS.heavy]) for (const yaw of [0, 29, -29, 50]) for (const seed of [1, 2, 3, 4]) {
    const sp = generate(applyIntent(TOUSLED, I).profile, seed); const V = viewAt(yaw);
    cases.push({ plan: orderStability(H, sp, V, 8, 'all', false), vol: orderStability(H, sp, V, 8, 'all', true) });
  }
  const agg = (f: (c: { plan: Stability; vol: Stability }) => Stability): { len: number; rate: number } => { let l = 0; let fl = 0; for (const c of cases) { const s = f(c); l += s.segLength; fl += s.segRate * s.segLength; } return { len: l, rate: l ? fl / l : 0 }; };
  const plan = agg((c) => c.plan); const vol = agg((c) => c.vol);
  it('le volume ne rend pas l\'ordre par tronçon moins fiable (agrégé, écart ≤ 1 point) et impose au plus 40 % de la longueur ordonnée du plan', () => {
    expect(vol.rate).toBeLessThanOrEqual(plan.rate + 0.01); expect(vol.len).toBeLessThan(plan.len * 0.4);
  });
  it('l\'ordre imposé par tronçon est fiable en absolu : ≤ 5 % de longueur inversée à 8° (mesuré ≈ 3 %)', () => {
    expect(vol.rate).toBeLessThan(0.05); expect(plan.rate).toBeLessThan(0.05);
  });
  it('cas par cas, en nombre ABSOLU : le volume n\'inverse pas plus de paires que le plan dans ≥ 90 % des cas (le taux par paire sur 3–10 paires n\'est que du bruit)', () => {
    const ok = cases.filter((c) => c.vol.flipped <= c.plan.flipped).length; expect(ok / cases.length).toBeGreaterThanOrEqual(0.9);
  });
  it('les nouveaux champs sont cohérents : segRate dans [0,1], segLength ≥ 0, aucun changement des champs historiques', () => {
    for (const c of cases) for (const s of [c.plan, c.vol]) { expect(s.segRate).toBeGreaterThanOrEqual(0); expect(s.segRate).toBeLessThanOrEqual(1); expect(s.segLength).toBeGreaterThanOrEqual(0); expect(s.rate).toBeCloseTo(s.imposed ? s.flipped / s.imposed : 0, 12); }
  });
});
