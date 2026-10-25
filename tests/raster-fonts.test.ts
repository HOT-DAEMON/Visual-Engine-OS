import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { el } from '../src/core/svg';
import { generateRandomFace } from '../src/generation/random-face';
import { compileScene } from '../src/compile';

/**
 * Hypothèse qui justifie `loadSystemFonts: false` (≈ 65 ms gagnés par rendu, docs/PERF-2.md) : le moteur n'émet jamais de texte.
 * Si l'une de ces propriétés cesse d'être vraie, ce test l'annonce avant qu'un rendu silencieusement différent n'arrive.
 */
describe('rastérisation sans polices système', () => {
  it('la liste blanche SVG interdit <text> et <tspan>', () => {
    expect(() => el('text')).toThrow();
    expect(() => el('tspan')).toThrow();
  });
  it('un visage complet ne contient aucun <text>, et son rendu est identique avec ou sans polices', () => {
    const f = generateRandomFace(21, { structure: true });
    const c = compileScene({ width: 170, height: 210, objects: f.objects });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.svg).not.toContain('<text');
    const a = new Resvg(c.svg, { fitTo: { mode: 'width', value: 170 }, font: { loadSystemFonts: true } }).render().pixels;
    const b = new Resvg(c.svg, { fitTo: { mode: 'width', value: 170 }, font: { loadSystemFonts: false } }).render().pixels;
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });
});
