import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src/generation/random-face';

describe('tirage aléatoire des oreilles (option draw.ears)', () => {
  it('sans l\'option, les visages structurés sont identiques seed pour seed', () => {
    const a = generateRandomFace(77, { structure: true });
    const b = generateRandomFace(77, { structure: { draw: { ears: false } } });
    expect(JSON.stringify(a.params)).toBe(JSON.stringify(b.params));
  });
  it('avec l\'option : seul le bloc oreilles change, de façon déterministe', () => {
    const base = generateRandomFace(77, { structure: true });
    const e1 = generateRandomFace(77, { structure: { draw: { ears: true } } });
    const e2 = generateRandomFace(77, { structure: { draw: { ears: true } } });
    expect(JSON.stringify(e1.params)).toBe(JSON.stringify(e2.params));
    const strip = (p: object): string => JSON.stringify({ ...p, ears: undefined });
    expect(strip(e1.params)).toBe(strip(base.params));
    expect(JSON.stringify(e1.params.ears)).not.toBe(JSON.stringify(base.params.ears));
  });
  it('la famille humaine domine et les morphologies restent dans les plages sûres', () => {
    let human = 0;
    for (let s = 1; s <= 200; s++) {
      const e = generateRandomFace(s, { structure: { draw: { ears: true } } }).params.ears;
      if (e.family === 'human') human++;
      expect(Math.abs(e.morph.lobule.length)).toBeLessThanOrEqual(0.8);
    }
    expect(human).toBeGreaterThan(150);
  });
});
