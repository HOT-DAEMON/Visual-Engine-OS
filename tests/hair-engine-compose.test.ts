import { describe, expect, it } from 'vitest';
import { analyzeComposition, correlation, shellDensity } from '../src/hair-grammar/compose';
import { composeHair, densityTarget, type CompositionSpec } from '../src/hair-grammar/compose-plan';
import { verifyComposed } from '../src/hair-grammar/compose-verify';
import { generate } from '../src/hair-grammar/grammar';
import { localGeometry } from '../src/hair-grammar/local-geometry';
import { paintHairPro, paintLockPro } from '../src/hair-grammar/paint-pro';
import { repairCycle } from '../src/hair-grammar/repair';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import type { LockSpec } from '../src/hair-grammar/lock';
import { v3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const V = viewAt(0.5);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

describe('analyse de composition : sept mesures', () => {
  const specs = generate(TOUSLED, 1); const c = analyzeComposition(DEFAULT_HEAD, specs, V);
  it('hiérarchie : parts de masses somment à 1, une masse domine', () => {
    expect(c.masses.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 6);
    expect(c.masses[0]?.role).toBe('dominant'); expect(c.hierarchy.ratio).toBeGreaterThanOrEqual(1);
  });
  it('équilibre : moment borné et parts G/D complémentaires', () => { expect(c.balance.left + c.balance.right).toBeCloseTo(1, 6); expect(Math.abs(c.balance.moment)).toBeLessThan(1); });
  it('espaces négatifs : ratio dans [0, 1], enveloppe non vide', () => { expect(c.negative.ratio).toBeGreaterThanOrEqual(0); expect(c.negative.ratio).toBeLessThanOrEqual(1); expect(c.negative.envelope).toBeGreaterThan(100); });
  it('densité : carte normalisée et corrélation d\'une carte avec elle-même = 1', () => { expect(c.density.flat().reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6); expect(correlation(c.density, c.density)).toBeCloseTo(1, 9); });
  it('mesure indépendante du nombre de mèches : doubler l\'ensemble ne déplace pas la lecture de plus de 0,2 rad', () => { const d = analyzeComposition(DEFAULT_HEAD, [...specs, ...generate(TOUSLED, 1)], V); expect(Math.abs(wrap(d.reading.angle - c.reading.angle))).toBeLessThan(0.2); });
});

describe('composition pilotant la génération (boucle mesurer → corriger)', () => {
  it('lecture : trois directions cibles sont atteintes à 0,6 rad près et l\'ordre est conservé', () => {
    const got = [0.35, 1.57, 2.8].map((t) => composeHair(TOUSLED, { reading: t }, 1, V, 6).composition.reading.angle);
    got.forEach((g, i) => expect(Math.abs(wrap(g - [0.35, 1.57, 2.8][i]!))).toBeLessThan(0.6));
    expect(got[0]!).toBeLessThan(got[1]!); expect(got[1]!).toBeLessThan(got[2]!);
  });
  it('équilibre : le moment suit la cible (−0,25 / 0 / 0,25) à 0,12 près', () => {
    for (const b of [-0.25, 0, 0.25]) expect(Math.abs(composeHair(TOUSLED, { balance: b }, 1, V, 6).composition.balance.moment - b)).toBeLessThan(0.12);
  });
  it('hiérarchie : la part visée de la masse dominante est approchée à 0,1 près', () => {
    const r = composeHair(TOUSLED, { hierarchy: { mass: 0.55, sweep: 0.2, fringe: 0.1, farSide: 0.08, nearSide: 0.07 } }, 1, V, 6);
    expect(Math.abs((r.composition.masses.find((m) => m.family === 'mass')?.share ?? 0) - 0.55 * 0.92)).toBeLessThan(0.1);
  });
  it('densité : une carte cible concentrée sur la nuque rapproche la carte mesurée (corrélation ↑)', () => {
    const spec: CompositionSpec = { density: { base: 0.05, blobs: [{ el: 40, az: -135, sigma: 30, gain: 1 }] } };
    const base = composeHair(TOUSLED, {}, 2, V, 0).composition.density; const tgt = densityTarget(spec.density!); const dens = composeHair(TOUSLED, spec, 2, V, 2).composition.density;
    expect(correlation(dens, tgt)).toBeGreaterThan(correlation(base, tgt));
  });
  it('focal : un épi construit est retrouvé comme point focal « whorl » ; une mèche d\'accent comme « accent »', () => {
    const w = composeHair(TOUSLED, { focal: [{ kind: 'whorl', at: { x: 0.0, y: -0.55 } }] }, 1, V, 0).specs; expect(w.filter((s) => s.family === 'whorl')).toHaveLength(7);
    expect(analyzeComposition(DEFAULT_HEAD, w, V).focal.some((f) => f.kind === 'whorl')).toBe(true);
    const a = composeHair(TOUSLED, { focal: [{ kind: 'accent', at: { x: 0.6, y: 0.2 } }] }, 1, V, 0).specs; expect(a.some((s) => s.family === 'accent')).toBe(true);
  });
  it('déterminisme : mêmes graines et mêmes cibles → mêmes mèches', () => { expect(composeHair(TOUSLED, { reading: 1, balance: 0.1 }, 3, V, 3).specs).toEqual(composeHair(TOUSLED, { reading: 1, balance: 0.1 }, 3, V, 3).specs); });
  it('corridor négatif : des mèches qui le traversent sont retirées (plafond 22 %)', () => {
    const n0 = composeHair(TOUSLED, {}, 1, V, 0).specs.length; const n1 = composeHair(TOUSLED, { channels: [{ from: { x: -0.9, y: 0 }, to: { x: 0.9, y: 0 }, half: 0.1 }] }, 1, V, 0).specs.length;
    expect(n1).toBeLessThan(n0); expect(n1).toBeGreaterThanOrEqual(Math.floor(n0 * 0.77));
  });
});

describe('géométrie locale et finition pilotée', () => {
  const L: LockSpec = { id: 'a', family: 'mass', root: { el: 70, az: 20 }, aim: v3(0, 1, 0.2), length: 0.8, bend: 0.3, wave: { amp: 0.1, freq: 1, phase: 0 }, flick: { amt: 0.2, len: 0.2 }, lift0: 0.05, lift1: 0.15, liftPow: 1.4, gravity: 0.1, width: 0.2, peak: 0.4, taper: 1.2, tone: 0, strands: 2, layer: 'front' };
  it('LockGeom : tableaux de même longueur, tangentes et normales unitaires, expositions dans [0, 1]', () => {
    const p = paintLockPro(DEFAULT_HEAD, L, V); const g = p.geom;
    for (const k of ['tangent', 'normal', 'curvature', 'orientation', 'twist', 'width', 'depth', 'normal3', 'exposure', 'backface', 'occlusion'] as const) expect(g[k]).toHaveLength(g.n);
    g.tangent.forEach((t) => expect(Math.hypot(t.x, t.y)).toBeCloseTo(1, 6)); g.exposure.forEach((e) => { expect(e).toBeGreaterThanOrEqual(0); expect(e).toBeLessThanOrEqual(1); });
  });
  it('torsion : une mèche à programme torsadé a un reflet différent d\'une mèche plate (l\'apparence suit la géométrie)', () => {
    const flat = paintLockPro(DEFAULT_HEAD, { ...L, program: [{ kind: 'straight', len: 1 }] }, V); const tw = paintLockPro(DEFAULT_HEAD, { ...L, program: [{ kind: 'twist', len: 1, turns: 1.5 }] }, V);
    expect(tw.geom.twist.some((x) => Math.abs(x) > 1)).toBe(true); expect(tw.svg).not.toBe(flat.svg);
  });
  it('occlusion locale : nulle sans relation, = 1 sur le tronçon recouvert (via localGeometry)', () => {
    const p = paintLockPro(DEFAULT_HEAD, L, V); expect(Math.max(...p.geom.occlusion)).toBe(0);
    const g2 = localGeometry(DEFAULT_HEAD, L, p.blade, V, undefined, p.blade.spine.map((_, i) => (i > 10 ? 1 : 0))); expect(g2.occlusion[20]).toBe(1);
  });
  it('paintHairPro : une coiffure complète produit les trois calques, une géométrie par mèche, sans NaN', () => {
    const specs = generate(TOUSLED, 1); const h = paintHairPro(DEFAULT_HEAD, specs, V);
    expect(h.geoms).toHaveLength(specs.length); expect(h.back + h.front + h.over).not.toMatch(/NaN|undefined/);
  });
});

describe('vérification en trois couches + réparation', () => {
  const specs = generate(TOUSLED, 1); const v = verifyComposed(DEFAULT_HEAD, specs, V);
  it('trois rapports (géométrie, anatomie, style), défauts localisés et score = somme des gravités', () => {
    expect(v.reports.map((r) => r.layer)).toEqual(['geometry', 'anatomy', 'style']);
    expect(v.score).toBeCloseTo(v.defects.reduce((s, d) => s + d.severity, 0), 9);
    v.defects.filter((d) => d.code.startsWith('geom.') || d.code === 'anat.eye').forEach((d) => expect(d.lock).toBeTruthy());
  });
  it('détecte un défaut injecté : lame dégénérée (longueur ≈ 0) et œil recouvert', () => {
    const tiny: LockSpec = { ...specs[0]!, id: 'tiny', length: 0.001, lift0: 0, lift1: 0 }; const d1 = verifyComposed(DEFAULT_HEAD, [...specs, tiny], V).defects.find((d) => d.code === 'geom.degenerate' && d.lock === 'tiny'); expect(d1).toBeTruthy();
    const eye: LockSpec = { ...specs[0]!, id: 'eyecover', family: 'fringe', root: { el: 52, az: 12 }, aim: v3(0.1, 1, 0.4), length: 0.9, width: 0.7, layer: 'front' };
    expect(verifyComposed(DEFAULT_HEAD, [...specs, eye], V).defects.some((d) => d.code === 'anat.eye')).toBe(true);
  });
  it('cycle de réparation : le score ne monte jamais, chaque tentative gardée l\'a fait baisser, journal complet', () => {
    const r = repairCycle(TOUSLED, specs, V, 1, 6);
    expect(r.verdict.score).toBeLessThanOrEqual(v.score);
    r.journal.forEach((a) => { if (a.kept) expect(a.after).toBeLessThan(a.before); else expect(a.after).toBeGreaterThanOrEqual(a.before); });
    expect(r.specs).toHaveLength(specs.length);
  });
});

describe('densité de coque', () => { it('shellDensity est normalisée', () => { expect(shellDensity(DEFAULT_HEAD, generate(TOUSLED, 1)).flat().reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6); }); });
