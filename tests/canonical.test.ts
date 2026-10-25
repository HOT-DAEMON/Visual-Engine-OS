import { describe, expect, it } from 'vitest';
import { canonical } from '../src/perf';
import { mulberry32 } from '../src/core/prng';

/** Implémentation d'origine (référence) : la version optimisée doit rendre EXACTEMENT les mêmes chaînes. */
function ref(v: unknown): string {
  if (v === null || typeof v !== 'object') return typeof v === 'number' && !Number.isFinite(v) ? `"${v}"` : JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(ref).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${ref(o[k])}`).join(',')}}`;
}

describe('canonical : identique à la référence', () => {
  it('même chaîne sur 3000 structures aléatoires imbriquées (undefined, NaN, clés spéciales, tableaux vides)', () => {
    const r = mulberry32(99);
    const keys = ['a', 'b', 'zz', 'é', 'with space', 'quote"d', 'new\nline', '0', '__proto__x', ''];
    const gen = (d: number): unknown => {
      const t = r();
      if (d > 3 || t < 0.25) return [0, -0, 1.5, NaN, Infinity, 'x"y', true, null, undefined, 1e21, 'ü'][Math.floor(r() * 11)];
      if (t < 0.5) return Array.from({ length: Math.floor(r() * 4) }, () => gen(d + 1));
      const o: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(r() * 5); i++) o[keys[Math.floor(r() * keys.length)] as string] = gen(d + 1);
      return o;
    };
    for (let i = 0; i < 3000; i++) { const v = gen(0); expect(canonical(v)).toBe(ref(v)); }
  });
  it('un objet dont toutes les clés sont undefined donne {}', () => { expect(canonical({ a: undefined })).toBe('{}'); });
});
