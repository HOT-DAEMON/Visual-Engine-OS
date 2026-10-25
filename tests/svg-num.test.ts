import { describe, expect, it } from 'vitest';
import { num } from '../src/core/svg';
import { mulberry32 } from '../src/core/prng';

/** Référence : l'implémentation d'origine de `num`. Le chemin rapide doit lui être identique caractère pour caractère. */
const ref = (v: number): string => String(Number(v.toFixed(3)));

describe('num : chemin rapide identique à toFixed(3)', () => {
  it('même chaîne que la référence sur 400 000 valeurs de toutes magnitudes, y compris les demi-décimales', () => {
    const r = mulberry32(7);
    const bad: string[] = [];
    for (let i = 0; i < 400_000; i++) {
      const mag = 10 ** Math.floor(r() * 8 - 3);
      const v = (r() - 0.5) * 2 * mag;
      const half = Math.round(v * 1000) / 1000 + 0.0005; // piège : valeurs pile entre deux arrondis
      for (const x of [v, half, -half]) if (num(x) !== ref(x)) bad.push(`${x}: ${num(x)} ≠ ${ref(x)}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('cas limites : 0, -0, entiers, très petits', () => {
    for (const v of [0, -0, 1, -1, 1234567, 0.0004, -0.0004, 0.0005, 0.0015, 2.5, 1e-9, 999999999]) expect(num(v)).toBe(ref(v));
  });
  it('refuse toujours NaN et Infinity', () => {
    expect(() => num(NaN)).toThrow(RangeError);
    expect(() => num(Infinity)).toThrow(RangeError);
  });
});
