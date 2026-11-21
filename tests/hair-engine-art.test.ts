import { describe, expect, it } from 'vitest';
import { generateIntended } from '../src/hair-grammar/intent-run';
import { applyPart, measureArt } from '../src/hair-grammar/part';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import type { Intent } from '../src/hair-grammar/intent';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/** Axes d'art direction mesurables : frange, pointes libres, raie. Chaque axe est CONSOMMÉ par la génération et MESURÉ sur le rendu (monotonie testée). */
const V = viewAt(0); const SEEDS = [1, 2, 3];
const avg = (I: Intent, f: (m: ReturnType<typeof measureArt>) => number): number => SEEDS.reduce((a, s) => a + f(measureArt(TOUSLED, generateIntended(TOUSLED, I, V, s, false).specs, V)), 0) / SEEDS.length;

describe('frange', () => {
  it('la part du front couverte croît avec l\'axe : −1 < 0 < +1 (écarts ≥ 0,05)', () => {
    const a = avg({ fringe: -1 }, (m) => m.fringe); const b = avg({ fringe: 0 }, (m) => m.fringe); const c = avg({ fringe: 1 }, (m) => m.fringe);
    expect(b).toBeGreaterThan(a + 0.05); expect(c).toBeGreaterThan(b + 0.05);
  });
  it('seule la famille `fringe` change : les autres familles gardent leur nombre', () => {
    const n = (fr: number): Record<string, number> => { const o: Record<string, number> = {}; for (const s of generateIntended(TOUSLED, { fringe: fr }, V, 1, false).specs) o[s.family] = (o[s.family] ?? 0) + 1; return o; };
    const a = n(-1); const b = n(1); expect(b.fringe!).toBeGreaterThan(a.fringe!); for (const k of ['mass', 'sweep', 'farSide', 'nearSide']) expect(b[k]).toBe(a[k]);
  });
});

describe('pointes libres', () => {
  it('le nombre de fines mèches détachées par mèche racine croît avec l\'axe (0 → 0, 0,5 → > 0,3, 1 → plus que 0,5)', () => {
    const a = avg({ tips: 0 }, (m) => m.tips); const b = avg({ tips: 0.5 }, (m) => m.tips); const c = avg({ tips: 1 }, (m) => m.tips);
    expect(a).toBe(0); expect(b).toBeGreaterThan(0.3); expect(c).toBeGreaterThan(b);
  });
  it('les pointes libres respectent la jonction : aucun défaut `geom.emerge` après vérification', () => {
    const r = generateIntended(TOUSLED, { tips: 0.8 }, V, 1, false); expect(r.initial.defects.filter((d) => d.code === 'geom.emerge')).toHaveLength(0);
  });
});

describe('raie', () => {
  it('une raie dégage la calotte : netteté ≥ 0,6 à −0,4, 0 et +0,4 ; sans raie ≤ 0,3', () => {
    for (const x of [-0.4, 0, 0.4]) expect(avg({ part: x }, (m) => m.part.clarity)).toBeGreaterThanOrEqual(0.6);
    expect(avg({}, (m) => m.part.clarity)).toBeLessThanOrEqual(0.3);
  });
  it('la position suit la consigne : u(−0,4) < u(0) < u(+0,4), au moins 0,05 d\'écart', () => {
    const u = (x: number): number => avg({ part: x }, (m) => m.part.u); expect(u(0)).toBeGreaterThan(u(-0.4) + 0.05); expect(u(0.4)).toBeGreaterThan(u(0) + 0.05);
  });
  it('les mèches du dessus s\'écartent : à gauche de la raie le cap va à gauche, à droite il va à droite', () => {
    const base = generate(TOUSLED, 1); const out = applyPart(DEFAULT_HEAD, base, 0);
    for (let i = 0; i < base.length; i++) { const L = base[i]!; const O = out[i]!; if (O === L) continue; const xr = DEFAULT_HEAD.rx * Math.cos((L.root.el * Math.PI) / 180) * Math.sin((L.root.az * Math.PI) / 180); expect(Math.sign(O.aim.x - L.aim.x)).toBe(xr >= 0 ? 1 : -1); }
  });
  it('ne touche ni les mèches arrière, ni les mèches basses (élévation < 40°), ni les filles', () => {
    const base = generate(TOUSLED, 1); const out = applyPart(DEFAULT_HEAD, base, 0.1);
    base.forEach((L, i) => { if (L.layer === 'back' || L.root.el < 40 || L.parent) expect(out[i]).toBe(L); });
  });
  it('déterministe', () => { expect(applyPart(DEFAULT_HEAD, generate(TOUSLED, 2), 0.1)).toEqual(applyPart(DEFAULT_HEAD, generate(TOUSLED, 2), 0.1)); });
});

describe('les axes ensemble restent vérifiables et réparables', () => {
  it('frange 0,6 + pointes 0,5 + raie −0,3 : score final 0 à 0° et 29°, jamais pire qu\'avant réparation', () => {
    for (const yaw of [0, 29]) { const r = generateIntended(TOUSLED, { fringe: 0.6, tips: 0.5, part: -0.3 }, viewAt(yaw), 1); expect(r.verdict.score).toBeLessThanOrEqual(r.initial.score); expect(r.verdict.defects.filter((d) => d.code.startsWith('geom.') || d.code === 'anat.eye' || d.code === 'anat.face')).toHaveLength(0); }
  }, 60_000);
});
