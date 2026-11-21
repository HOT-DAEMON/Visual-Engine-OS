import { describe, expect, it } from 'vitest';
import { inPoly } from '../src/face/poly';
import { bladeOutline } from '../src/hair-grammar/blade';
import { branchHair, fray, joinGap, joinLocks, loopLock, loopProgram, splitLock } from '../src/hair-grammar/branch';
import { verifyComposed } from '../src/hair-grammar/compose-verify';
import { emergenceContinuity } from '../src/hair-grammar/emerge';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { allowedCrossings, spineCrossings } from '../src/hair-grammar/lock-check';
import { paintLock } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { refreshChildren } from '../src/hair-grammar/repair-local';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const H = DEFAULT_HEAD; const V = viewAt(29);
const specs = generate(TOUSLED, 1); const sweep = specs.find((s) => s.family === 'sweep')!; const masses = specs.filter((s) => s.family === 'mass');
const ok = (parent: Parameters<typeof emergenceContinuity>[1], c: Parameters<typeof emergenceContinuity>[2]): boolean => { const k = emergenceContinuity(H, parent, c); return k.gap <= 0.01 && k.angleDeg <= 12 && k.widthRatio <= 0.5; };

describe('séparation (fourche)', () => {
  it('2 et 3 branches naissent de la pointe du tronc, jonction continue (écart ≤ 0,01 H, angle ≤ 12°)', () => {
    for (const ways of [2, 3] as const) { const s = splitLock(H, sweep, { t: 0.55, ways }); expect(s.branches).toHaveLength(ways); for (const b of s.branches) { expect(b.parent?.id).toBe(s.trunk.id); expect(ok(s.trunk, b)).toBe(true); } }
  });
  it('le tronc est raccourci (s\'arrête à la fourche) et les branches s\'écartent : les pointes sont distinctes', () => {
    const s = splitLock(H, sweep, { t: 0.55, ways: 2, spread: 1.2 }); expect(s.trunk.length).toBeLessThan(sweep.length * 0.65);
    const tips = s.branches.map((b) => paintLock(H, b, V).blade.spine.at(-1)!); expect(Math.hypot(tips[0]!.x - tips[1]!.x, tips[0]!.y - tips[1]!.y)).toBeGreaterThan(0.05 * V.s);
  });
  it('l\'aire se conserve à la fourche : somme des largeurs des branches ≥ 1× la largeur du tronc', () => {
    const s = splitLock(H, sweep, { t: 0.55, ways: 2 }); expect(s.branches.reduce((a, b) => a + b.width, 0)).toBeGreaterThanOrEqual(sweep.width * 0.99);
  });
  it('chaque branche NAÎT DANS le volume du tronc : sa racine est à l\'intérieur de la lame du tronc (émerge, ne « commence pas à côté »)', () => {
    const s = splitLock(H, sweep, { t: 0.55, ways: 2 }); const o = bladeOutline(paintLock(H, s.trunk, V).blade);
    for (const b of s.branches) { const r = paintLock(H, b, V).blade.spine[0]!; expect(inPoly(o, r.x, r.y)).toBe(true); }
  });
});

describe('pointes libres', () => {
  it('n fines mèches s\'en détachent, toutes continues, plus fines que la mère, échelonnées sur sa fin', () => {
    const f = fray(H, sweep, { n: 4, from: 0.65 }); expect(f.length).toBeGreaterThanOrEqual(3);
    for (const c of f) { expect(ok(sweep, c)).toBe(true); expect(c.width).toBeLessThan(sweep.width * 0.5); expect(c.parent!.t).toBeGreaterThanOrEqual(0.3); }
    expect(new Set(f.map((c) => c.parent!.t.toFixed(2))).size).toBeGreaterThan(1);
  });
});

describe('jonction', () => {
  it('la pointe de la fille atteint la cible à 0,01 H près (3 paires de mèches)', () => {
    const q = specs.filter((s) => s.family === 'sweep');
    for (const [a, ta, b, tb] of [[masses[0]!, 0.5, masses[3]!, 0.6], [q[0]!, 0.4, q[2]!, 0.7], [q[1]!, 0.45, q[3]!, 0.8]] as const) { const j = joinLocks(H, a, ta, b, tb); expect(joinGap(H, j, b, tb)).toBeLessThan(0.01); expect(j.join).toEqual({ id: b.id, t: tb }); expect(j.parent?.id).toBe(a.id); }
  });
  it('une jonction manquée est détectée (défaut `geom.join`) puis réparée par re-résolution', () => {
    const a = masses[0]!; const b = masses[3]!; const j = joinLocks(H, a, 0.5, b, 0.6);
    const bad = [...specs.filter((s) => s.id !== a.id && s.id !== b.id), a, b, { ...j, length: j.length * 0.5, program: j.program }];
    expect(verifyComposed(H, bad, V).defects.some((d) => d.code === 'geom.join')).toBe(true);
    expect(verifyComposed(H, [...specs.filter((s) => s.id !== a.id && s.id !== b.id), a, b, j], V).defects.some((d) => d.code === 'geom.join')).toBe(false);
  });
  it('refreshChildren re-résout la jonction quand la cible a bougé', () => {
    const a = masses[0]!; const b = masses[3]!; const j = joinLocks(H, a, 0.5, b, 0.6);
    const moved = { ...b, length: b.length * 0.9, lift1: b.lift1 + 0.02 }; const list = [a, moved, j];
    const out = refreshChildren(TOUSLED, list, b.id); expect(joinGap(H, out[2]!, moved, 0.6)).toBeLessThan(0.02); // seuil de `geom.join`
  });
});

describe('boucle / enroulement', () => {
  it('une boucle ajoute exactement un croisement de l\'axe, autorisé par le programme', () => {
    const L = loopLock(sweep, { at: 0.4, radius: 0.04 }); const x = spineCrossings(paintLock(H, L, V).blade.spine);
    expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(allowedCrossings(L));
    expect(verifyComposed(H, [L], V).defects.filter((d) => d.code === 'geom.self')).toHaveLength(0);
  });
  it('le cap net d\'un tour entier est nul : la mèche repart dans sa direction d\'origine (programme continu, somme des poids = 1)', () => {
    const p = loopProgram(sweep, { at: 0.4, radius: 0.04 }); expect(p.reduce((a, s) => a + s.len, 0)).toBeCloseTo(1, 6); expect(p.some((s) => s.kind === 'loop')).toBe(true);
  });
  it('un croisement de trop reste signalé : une mèche à boucle dont l\'axe se coupe 4 fois ne passe pas', () => {
    expect(allowedCrossings(loopLock(sweep, { at: 0.4, radius: 0.04 }))).toBe(2);
    expect(allowedCrossings(sweep)).toBe(0);
  });
});

describe('ramification d\'une coiffure (branchHair)', () => {
  const B = { split: { prob: 0.15 }, fray: { prob: 0.3 }, loop: { prob: 0.08 } };
  it('déterministe, ajoute des mèches, ne touche ni les filles ni les mèches arrière', () => {
    const a = branchHair(TOUSLED, specs, B, 5); expect(a).toEqual(branchHair(TOUSLED, specs, B, 5)); expect(a.length).toBeGreaterThan(specs.length);
    for (const L of specs.filter((s) => s.layer === 'back')) expect(a.find((x) => x.id === L.id)).toEqual(L);
  });
  it('tous les ids sont uniques et chaque fille a sa mère dans la coiffure', () => {
    const a = branchHair(TOUSLED, specs, B, 5); expect(new Set(a.map((s) => s.id)).size).toBe(a.length);
    for (const s of a.filter((x) => x.parent)) expect(a.some((m) => m.id === s.parent!.id)).toBe(true);
  });
  it('la coiffure ramifiée ne crée aucun défaut de jonction ni de boucle non autorisée', () => {
    const a = branchHair(TOUSLED, specs, B, 5); const d = verifyComposed(H, a, V).defects; expect(d.filter((x) => x.code === 'geom.emerge' || x.code === 'geom.join')).toHaveLength(0);
  });
});
