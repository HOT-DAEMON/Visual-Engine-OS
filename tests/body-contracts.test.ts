import { describe, expect, it } from 'vitest';
import { BodyParams, bodyGeometry, type Atom } from '../src/body';
import { BODY_CONTRACTS, bodyOrder, downstream, readersOf } from '../src/body/contracts';
import { referenceAnchor } from './body-helpers';

const A = referenceAnchor();
const BASE = BodyParams.parse({ age: 28, sex: -1, adiposity: 0.3, muscularity: 0.4 });

function leaves(o: unknown, path = ''): string[] {
  if (typeof o === 'number') return [path];
  if (Array.isArray(o)) return o.flatMap((x, i) => leaves(x, `${path}.${i}`));
  return Object.entries(o as object).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k));
}
function setAt(o: unknown, path: string, val: number): unknown {
  const c = structuredClone(o) as Record<string, unknown>;
  const ks = path.split('.');
  let cur: Record<string, unknown> = c;
  for (const k of ks.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[ks[ks.length - 1] as string] = val;
  return c;
}
const getAt = (o: unknown, path: string): number => path.split('.').reduce<unknown>((c, k) => (c as Record<string, unknown>)[k], o) as number;
const sig = (a: Atom): string => `${a.view}|${a.poly.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`).join(';')}`;

describe('contrats du corps', () => {
  it('l’ordre de résolution est un tri topologique valide (pas de cycle, pas de besoin inconnu)', () => {
    const order = bodyOrder();
    expect(order.length).toBe(Object.keys(BODY_CONTRACTS).length);
    for (const [k, c] of Object.entries(BODY_CONTRACTS)) for (const n of c.needs) expect(order.indexOf(n)).toBeLessThan(order.indexOf(k));
  });
  it('un cycle ou un besoin inconnu est refusé', () => {
    expect(() => bodyOrder({ a: { needs: ['b'], reads: [], provides: [] }, b: { needs: ['a'], reads: [], provides: [] } })).toThrow(/cycle/);
    expect(() => bodyOrder({ a: { needs: ['zz'], reads: [], provides: [] } })).toThrow(/inconnu/);
  });
  it('chaque atome est FOURNI par le composant dont il porte le nom (préfixe d’id déclaré)', () => {
    const g = bodyGeometry(BASE, A);
    const bad = g.atoms.filter((a) => !BODY_CONTRACTS[a.part]?.provides.some((p) => a.id.startsWith(p)));
    expect(bad.map((a) => `${a.id}@${a.part}`)).toEqual([]);
    for (const k of Object.keys(BODY_CONTRACTS)) expect(g.atoms.some((a) => a.part === k), `composant sans atome : ${k}`).toBe(true);
  });
  it('INFLUENCE : perturber un paramètre ne change que des composants en aval d’un lecteur déclaré — et tout paramètre agit', () => {
    const g0 = bodyGeometry(BASE, A);
    const ref = new Map(g0.atoms.map((a) => [a.id, sig(a)]));
    const paths = leaves(BASE);
    expect(paths.length).toBeGreaterThan(40);
    const noEffect: string[] = [], lies: string[] = [];
    for (const path of paths) {
      const v0 = getAt(BASE, path);
      let g1 = null, used = NaN;
      for (const d of [0.25, -0.25, 6, -6, 30, -30]) {
        const parsed = BodyParams.safeParse(setAt(BASE, path, v0 + d));
        if (parsed.success) { g1 = bodyGeometry(parsed.data, A); used = d; break; }
      }
      expect(g1, `aucune perturbation valide pour ${path}`).not.toBeNull();
      void used;
      const changed = new Set<string>();
      for (const a of g1!.atoms) if (ref.get(a.id) !== sig(a)) changed.add(a.part);
      if (changed.size === 0) noEffect.push(path);
      const allowed = downstream(readersOf(path));
      for (const part of changed) if (!allowed.has(part)) lies.push(`${path} → ${part}`);
    }
    expect(lies, 'un composant change sans l’avoir déclaré').toEqual([]);
    expect(noEffect, 'paramètres sans aucun effet (contrat inutile ou bug)').toEqual([]);
  });
  it('le test DÉTECTE un contrat menteur : retirer une lecture déclarée fait apparaître le composant fautif', () => {
    const liar = { ...BODY_CONTRACTS, 'upper-arm.L': { ...BODY_CONTRACTS['upper-arm.L']!, reads: ['age'] } };
    const path = 'pose.left.abduction';
    const g1 = bodyGeometry(BodyParams.parse(setAt(BASE, path, 40)), A), g0 = bodyGeometry(BASE, A);
    const ref = new Map(g0.atoms.map((a) => [a.id, sig(a)]));
    const changed = new Set(g1.atoms.filter((a) => ref.get(a.id) !== sig(a)).map((a) => a.part));
    const allowed = downstream(readersOf(path, liar), liar);
    expect([...changed].some((p) => !allowed.has(p))).toBe(true);
  });
});
