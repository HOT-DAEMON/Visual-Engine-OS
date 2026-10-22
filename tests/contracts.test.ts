import { describe, expect, it } from 'vitest';
import { CONTRACTS, MONOTONE, componentOf, influenceMap, measureFace, resolutionOrder, upstream } from '../src/face/contracts';
import { Resolver } from '../src/core/resolve';
import { FaceParams } from '../src/schema';
import { faceLandmarks } from '../src/face';

/** Contrats, mesures, invariants et procédure de résolution (docs/CONTRACTS.md). */
describe('ordre de résolution déterministe', () => {
  it('même ordre à chaque appel, dépendances respectées', () => {
    const o = resolutionOrder(CONTRACTS);
    expect(resolutionOrder(CONTRACTS)).toEqual(o);
    expect(o).toEqual(resolutionOrder([...CONTRACTS].reverse()));
    for (const c of CONTRACTS) for (const n of c.needs) expect(o.indexOf(n)).toBeLessThan(o.indexOf(c.id));
  });
  it('cycle et dépendance inconnue : erreurs explicites', () => {
    expect(() => resolutionOrder([{ id: 'a', needs: ['b'], reads: [], provides: [] }, { id: 'b', needs: ['a'], reads: [], provides: [] }])).toThrow(/cycle/);
    expect(() => resolutionOrder([{ id: 'a', needs: ['z'], reads: [], provides: [] }])).toThrow(/inconnue/);
  });
});

describe('résolveur commun', () => {
  it('borne, enregistre la correction, MAX prioritaire si les bornes se croisent', () => {
    const R = new Resolver();
    expect(R.limit('a', 'p', 5, 0, 3, 'r')).toBe(3);
    expect(R.limit('b', 'q', 1, 0, 3, 'r')).toBe(1);
    expect(R.limit('c', 's', 0, 4, 2, 'r')).toBe(2);
    expect(R.applied.map((c) => c.id)).toEqual(['a', 'c']);
    expect(R.applied[0]).toMatchObject({ requested: 5, applied: 3 });
  });
  it('mouth.width au-delà du contour : correction OBSERVABLE (plus de saturation silencieuse)', () => {
    const lm = faceLandmarks(FaceParams.parse({ anatomyEngine: 'structured', mouth: { width: 0.5 } }), 300, 380);
    const c = lm.corrections.find((x) => x.id === 'mouth-inside-contour');
    expect(c).toBeDefined();
    expect(c!.applied).toBeLessThan(c!.requested);
  });
});

describe('contrats vérifiés contre l\'influence mesurée', () => {
  const map = influenceMap();
  it('toute influence mesurée est déclarée par le composant ou par un composant dont il dépend', () => {
    const undeclared: string[] = [];
    for (const [param, ms] of Object.entries(map.influences)) {
      for (const comp of new Set(ms.map(componentOf))) {
        const ups = [...upstream(CONTRACTS, comp)].flatMap((id) => CONTRACTS.find((c) => c.id === id)?.reads ?? []);
        if (!ups.some((r) => param === r || param.startsWith(`${r}.`))) undeclared.push(`${param} → ${comp}`);
      }
    }
    expect(undeclared).toEqual([]);
  });
  it('toute mesure appartient à un composant contractuel', () => {
    const owned = new Set(CONTRACTS.flatMap((c) => c.provides));
    expect(map.measures.filter((m) => ![...owned].some((o) => m.startsWith(o)))).toEqual([]);
  });
  it('mesures finies et déterministes', () => {
    const p = FaceParams.parse({ anatomyEngine: 'structured' });
    const a = measureFace(p, 300, 380);
    expect(measureFace(p, 300, 380)).toEqual(a);
    for (const v of Object.values(a)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('invariants de monotonie (pas de zone morte inattendue)', () => {
  it.each(MONOTONE.map((r) => [`${r.param} → ${r.measure}`, r] as const))('%s', (_n, r) => {
    const vals = r.sweep.map((v) => {
      const patch: Record<string, unknown> = { anatomyEngine: 'structured', ...(r.base ?? {}) };
      const ks = r.param.split('.'); let c = patch;
      for (const k of ks.slice(0, -1)) { c[k] = { ...((c[k] as object) ?? {}) }; c = c[k] as Record<string, unknown>; }
      c[ks[ks.length - 1]!] = v;
      return measureFace(FaceParams.parse(patch), 300, 380)[r.measure]!;
    });
    for (let i = 1; i < vals.length; i++) expect((vals[i]! - vals[i - 1]!) * r.direction).toBeGreaterThan(1e-9);
  });
});
