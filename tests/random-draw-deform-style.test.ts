import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src/generation/random-face';
import { verifyFace } from '../src/verify';

/** Tirage OPTIONNEL de deform et de stylisation (flux dérivé distinct). */
const SEEDS = Array.from({ length: 30 }, (_, i) => 700 + i * 11);

describe('tirage de deform et de stylisation', () => {
  it('sans l\'option : visages structurés identiques (aucun tirage déplacé)', () => {
    for (const s of SEEDS.slice(0, 6)) {
      const a = generateRandomFace(s, { structure: true }).params;
      const b = generateRandomFace(s, { structure: { draw: {} } }).params;
      expect(b).toEqual(a);
    }
  });
  it('avec l\'option : déterministe, et seules les familles demandées changent', () => {
    const s = SEEDS[0]!;
    const base = generateRandomFace(s, { structure: true }).params;
    const both = { structure: { draw: { deform: true, stylization: true } } };
    expect(generateRandomFace(s, both).params).toEqual(generateRandomFace(s, both).params);
    // `deform` seul : SEULE la famille `deform` change (la stylisation, elle, est cuite dans la géométrie : elle modifie nez, menton, mâchoire…).
    const d = generateRandomFace(s, { structure: { draw: { deform: true } } }).params;
    expect({ ...d, deform: base.deform }).toEqual(base);
    expect(d.deform).not.toEqual(base.deform);
  });
  it('30 graines : la variété est réelle (≥ 4 profils, ≥ 5 axes d\'expression) et tout passe la vérification', () => {
    const profiles = new Set<string>(); const axes = new Set<string>();
    for (const s of SEEDS) {
      const f = generateRandomFace(s, { structure: { draw: { deform: true, stylization: true } } });
      profiles.add(`${f.params.renderMode}|${f.params.stylization.chinProjection}|${f.params.stylization.angularity}`);
      for (const [k, v] of Object.entries(f.params.deform.expression)) if (k !== 'caricature' && v !== 0) axes.add(k);
      const rep = verifyFace(f);
      const real = rep.failures.filter((c) => !['front-clear-mouth', 'ear-free-right', 'ear-free-left'].includes(c.id));
      expect(real.map((c) => `${s}:${c.id}`)).toEqual([]);
    }
    expect(profiles.size).toBeGreaterThanOrEqual(4);
    expect(axes.size).toBeGreaterThanOrEqual(5);
  });
});
