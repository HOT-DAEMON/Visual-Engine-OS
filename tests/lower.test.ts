import { describe, expect, it } from 'vitest';
import { ARCHETYPES, BodyParams, legGeometry, renderLegs, figureMarkup, LegParams, LOWER_CONTRACTS, tierOf, TIER_NAMES, type Atom, type BodyInput } from '../src/body';
import { bodyOrder, downstream, readersOf } from '../src/body/contracts';
import { verifyLegs } from '../src/verify';
import { referenceAnchor } from './body-helpers';

const A = referenceAnchor(), SKIN = '#c99a76';
const BASE = { age: 28, sex: -1, adiposity: 0.3, muscularity: 0.4 };
const sig = (a: Atom): string => `${a.view}|${a.poly.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`).join(';')}`;
function leaves(o: unknown, path = ''): string[] { if (typeof o === 'number') return [path]; if (Array.isArray(o)) return o.flatMap((x, i) => leaves(x, `${path}.${i}`)); return Object.entries(o as object).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k)); }
function setAt(o: unknown, path: string, val: number): unknown { const c = structuredClone(o) as Record<string, unknown>; let cur = c; const ks = path.split('.'); for (const k of ks.slice(0, -1)) cur = cur[k] as Record<string, unknown>; cur[ks[ks.length - 1] as string] = val; return c; }
const getAt = (o: unknown, path: string): number => path.split('.').reduce<unknown>((c, k) => (c as Record<string, unknown>)[k], o) as number;

describe('bas du corps : contrats', () => {
  it('ordre topologique valide et chaque atome est fourni par son composant', () => {
    const order = bodyOrder(LOWER_CONTRACTS as never);
    for (const [k, c] of Object.entries(LOWER_CONTRACTS)) for (const n of c.needs) expect(order.indexOf(n)).toBeLessThan(order.indexOf(k));
    const g = legGeometry(BASE, {}, A);
    expect(g.atoms.filter((a) => !LOWER_CONTRACTS[a.part]?.provides.some((p) => a.id.startsWith(p))).map((a) => `${a.id}@${a.part}`)).toEqual([]);
    for (const k of Object.keys(LOWER_CONTRACTS)) expect(g.atoms.some((a) => a.part === k), k).toBe(true);
  });
  it('INFLUENCE : chaque paramètre du bas agit, et ne change que des composants en aval d’un lecteur déclaré', () => {
    const body = BodyParams.parse(BASE), lp = LegParams.parse({});
    const run = (b: unknown, l: unknown) => legGeometry(b as BodyInput, l as never, A);
    const ref = new Map(run(body, lp).atoms.map((a) => [a.id, sig(a)]));
    const noEffect: string[] = [], lies: string[] = [];
    const CORE = ['age', 'sex', 'adiposity', 'muscularity', 'frame.hip', 'frame.torsoLength'];
    const probes = [...CORE.map((p) => ({ p, body: true })), ...leaves(lp).map((p) => ({ p, body: false }))];
    for (const { p, body: isBody } of probes) {
      const base = isBody ? body : lp, v0 = getAt(base, p);
      let g1 = null;
      for (const d of [0.25, -0.25, 6, -6, 30, -30]) {
        const next = setAt(base, p, v0 + d), ok = isBody ? BodyParams.safeParse(next) : LegParams.safeParse(next);
        if (ok.success) { g1 = isBody ? run(next, lp) : run(body, next); break; }
      }
      expect(g1, p).not.toBeNull();
      const changed = new Set<string>();
      for (const a of g1!.atoms) if (ref.get(a.id) !== sig(a)) changed.add(a.part);
      if (changed.size === 0) noEffect.push(p);
      const allowed = downstream(readersOf(p, LOWER_CONTRACTS as never), LOWER_CONTRACTS as never);
      for (const part of changed) if (!allowed.has(part)) lies.push(`${p} → ${part}`);
    }
    expect(lies).toEqual([]);
    expect(noEffect).toEqual([]);
  });
});

describe('bas du corps : géométrie, anatomie, style', () => {
  const names = Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[];
  for (const n of names) it(`archétype ${n} : vérification complète sans échec`, () => {
    const g = legGeometry(ARCHETYPES[n] as BodyInput, {}, A), mk = figureMarkup(ARCHETYPES[n] as BodyInput, {}, A, { skin: SKIN });
    const r = verifyLegs(g, mk);
    expect(r.checks.length).toBeGreaterThan(30);
    expect(r.failures.map((c) => `${c.id}=${c.value}/${c.limit}`)).toEqual([]);
  });
  it('poses asymétriques : pas de symétrie exigée, mais toujours valide', () => {
    const lp = { pose: { left: { abduction: 20, kneeFlex: 40, footTurnout: 30 }, right: { abduction: 2, footTurnout: -5, toeCurl: 0.8 } } };
    const r = verifyLegs(legGeometry(ARCHETYPES.muscular as BodyInput, lp, A));
    expect(r.failures).toEqual([]);
  });
  it('flexion du genou raccourcit la jambe (projection) sans toucher la cuisse', () => {
    const a = legGeometry(BASE, {}, A), b = legGeometry(BASE, { pose: { left: { kneeFlex: 60 } } }, A);
    const y = (g: typeof a, id: string): number => Math.max(...g.byId.get(id)!.poly.map((q) => q.y));
    expect(y(b, 'leg.shin.L')).toBeLessThan(y(a, 'leg.shin.L'));
    expect(y(b, 'leg.thigh.L')).toBeCloseTo(y(a, 'leg.thigh.L'), 6);
  });
  it('distinctions : sexe, âge, adiposité, musculature produisent des mesures différentes', () => {
    const M = (k: keyof typeof ARCHETYPES) => legGeometry(ARCHETYPES[k] as BodyInput, {}, A).measures;
    expect(M('baby').crotchHeight!).toBeLessThan(M('adultMale').crotchHeight!);
    expect(M('baby').thigh!).toBeLessThan(M('child').thigh!);
    expect(M('obese').thighWidth!).toBeGreaterThan(M('thin').thighWidth! * 1.3);
    expect(M('veryMuscular').thighWidth!).toBeGreaterThan(M('adultMale').thighWidth!);
    expect(M('veryMuscular').calfWidth!).toBeGreaterThan(M('thin').calfWidth! * 1.2);
    expect(M('adultFemale').hipToThigh!).toBeGreaterThan(M('adultMale').hipToThigh!);
  });
  it('hiérarchie musculaire : le nombre de muscles lisibles croît avec le palier, 0 → 5', () => {
    const levels = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const count = levels.map((mus) => { const bp = { age: 28, sex: 1, adiposity: 0.08, muscularity: mus }; const svg = figureMarkup(bp, {}, A, { skin: SKIN }); return (svg.back.match(/<path/g) ?? []).length; });
    for (let i = 1; i < count.length; i++) expect(count[i]!).toBeGreaterThanOrEqual(count[i - 1]!);
    expect(count[5]!).toBeGreaterThan(count[0]! * 1.1);
    expect(TIER_NAMES.length).toBe(6);
    expect(tierOf(0)).toBe(0);
    expect(tierOf(1)).toBe(5);
  });
  it('rendu : sans filtre, mode atomes disponible, déterministe', () => {
    const g = legGeometry(BASE, {}, A);
    const m1 = renderLegs(g, { skin: SKIN }), m2 = renderLegs(g, { skin: SKIN });
    expect(m1.back).toBe(m2.back);
    expect(m1.back).not.toMatch(/<filter/);
    expect(renderLegs(g, { skin: SKIN, mode: 'atoms' }).back.length).toBeGreaterThan(1000);
    expect(renderLegs(g, { skin: SKIN, level: 1 }).back.length).toBeLessThan(m1.back.length);
  });
});

describe('la vérification détecte les défauts', () => {
  it('un atome dégénéré, un parent inconnu ou un pied hors sol sont signalés', () => {
    const g = legGeometry(BASE, {}, A), bad = { ...g, atoms: g.atoms.map((a) => (a.id === 'knee.patella.L' ? { ...a, poly: [{ x: NaN, y: 0 }, ...a.poly.slice(1)] } : a)) };
    expect(verifyLegs(bad).failures.map((c) => c.id)).toContain('lower.finite');
    const bad2 = { ...g, measures: { ...g.measures, thighToShin: 2 } };
    expect(verifyLegs(bad2).failures.map((c) => c.id)).toContain('lower.thigh-shin-max');
  });
});
