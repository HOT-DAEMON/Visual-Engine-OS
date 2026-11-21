import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { applyIntent, type Intent } from '../src/hair-grammar/intent';
import { observe, type Reference } from '../src/hair-grammar/observe';
import { observeStructure } from '../src/hair-grammar/observe-structure';
import { paintLock } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { fitFromReference, headEllipse, referenceFromPainted } from '../src/hair-grammar/reference-fit';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const V = viewAt(0); const W = 156; const Hh = 150;
const refOf = (I: Intent, seed: number): Reference => { const P = applyIntent(TOUSLED, I).profile; return referenceFromPainted(generate(P, seed).map((L) => paintLock(P.head, L, V)), W, Hh); };
const E = headEllipse(TOUSLED, V);

describe('rastérisation d\'une référence synthétique', () => {
  const R = refOf({}, 1);
  it('masque non vide, gris dans [0, 1], contours d\'encre présents (gris < 0,2) à l\'intérieur du masque', () => {
    let n = 0; let ink = 0; for (let i = 0; i < R.mask.length; i++) if (R.mask[i]) { n++; if ((R.gray[i] as number) < 0.2) ink++; expect(R.gray[i]).toBeLessThanOrEqual(1); }
    expect(n).toBeGreaterThan(2000); expect(ink / n).toBeGreaterThan(0.05);
  });
  it('déterministe', () => { expect(refOf({}, 1).mask).toEqual(R.mask); });
});

describe('observation structurée', () => {
  const S = observeStructure(refOf({}, 1), E);
  it('régions : parts positives qui somment à 1, triées, rangs 0…k−1, une région domine', () => {
    expect(S.regions.length).toBeGreaterThanOrEqual(3); expect(S.regions.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 6);
    for (let i = 1; i < S.regions.length; i++) expect(S.regions[i]!.share).toBeLessThanOrEqual(S.regions[i - 1]!.share); expect(S.hierarchy.ratio).toBeGreaterThanOrEqual(1);
  });
  it('axes signés dans ]−π, π] et cohérences dans [0, 1]', () => { for (const r of S.regions) { expect(Math.abs(r.axis)).toBeLessThanOrEqual(Math.PI + 1e-9); expect(r.coherence).toBeGreaterThanOrEqual(0); expect(r.coherence).toBeLessThanOrEqual(1.0001); } });
  it('déterministe (k-means à initialisation fixe)', () => { expect(observeStructure(refOf({}, 1), E)).toEqual(S); });
  it('raie : un sillon vide creusé à u = +0,3 dans la calotte est retrouvé (position ±0,08, netteté > 0,5) ; sans sillon, netteté plus faible', () => {
    const R = refOf({ weight: 1 }, 2); const cut: Reference = { ...R, mask: Uint8Array.from(R.mask) };
    const x0 = Math.round(E.cx + 0.3 * E.rx); for (let y = 0; y < Hh; y++) for (let x = x0 - 1; x <= x0 + 1; x++) if ((y - E.cy) / E.ry < -0.55) cut.mask[y * W + x] = 0;
    const a = observeStructure(cut, E).part; expect(Math.abs(a.u - 0.3)).toBeLessThan(0.08); expect(a.clarity).toBeGreaterThan(0.5); expect(observeStructure(R, E).part.clarity).toBeLessThan(a.clarity);
  });
  it('frange : effacer la bande du front fait chuter la part de frange mesurée', () => {
    const R = refOf({}, 1); const bare: Reference = { ...R, mask: Uint8Array.from(R.mask) };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const v = (y - E.cy) / E.ry; if (v >= -0.65 && v <= -0.2) bare.mask[y * W + x] = 0; }
    expect(observeStructure(bare, E).fringe).toBeLessThan(0.05); expect(S.fringe).toBeGreaterThan(0.3);
  });
  it('reflets : un éclat clair posé sur un gris moyen est compté, une aire uniforme n\'en a aucun', () => {
    const n = W * Hh; const m = new Uint8Array(n).fill(1); const g = new Float32Array(n).fill(0.4);
    expect(observeStructure({ w: W, h: Hh, mask: m, gray: g }, E).gloss.spots).toBe(0);
    for (let y = 40; y < 46; y++) for (let x = 60; x < 70; x++) g[y * W + x] = 0.95; expect(observeStructure({ w: W, h: Hh, mask: m, gray: g }, E).gloss.spots).toBe(1);
  });
});

describe('boucle fermée référence → coiffure', () => {
  // Référence = coiffure d'intention CONNUE (graine 7) ; l'ajustement part de la neutre et d'une autre graine (3).
  const lo = fitFromReference(TOUSLED, refOf({ volume: -0.6, weight: 0.6 }, 7), V, { seed: 3 });
  const hi = fitFromReference(TOUSLED, refOf({ volume: 0.8, weight: -0.5 }, 7), V, { seed: 3 });
  it('l\'écart de largeur observée diminue entre le premier et le dernier tour, et finit sous 0,06', () => {
    for (const f of [lo, hi]) { const a = Math.abs(f.steps[0]!.err.width); const b = Math.abs(f.steps.at(-1)!.err.width); expect(b).toBeLessThanOrEqual(a + 0.02); expect(b).toBeLessThan(0.06); }
  });
  it('le volume ajusté suit l\'ordre des références (+0,8 donne au moins 0,8 de plus que −0,6)', () => { expect((hi.intent.volume ?? 0) - (lo.intent.volume ?? 0)).toBeGreaterThan(0.8); });
  it('le poids ajusté suit l\'ordre des références (lourd > aérien)', () => { expect((lo.intent.weight ?? 0)).toBeGreaterThan(hi.intent.weight ?? 0); });
  it('la coiffure rendue est réparée : score de vérification nul, et jamais pire qu\'avant la réparation', () => {
    for (const f of [lo, hi]) { expect(f.repair.verdict.score).toBe(0); expect(f.specs.length).toBeGreaterThan(10); }
  });
  it('observations finales proches de la cible : largeur à 0,08 près, espaces négatifs à 0,06 près', () => {
    for (const f of [lo, hi]) { expect(Math.abs(f.final.widthRatio - f.target.widthRatio)).toBeLessThan(0.08); expect(Math.abs(f.final.negative - f.target.negative)).toBeLessThan(0.06); }
  });
  it('observe() sur la sortie = observe() sur la référence pour une même coiffure (la rastérisation est neutre)', () => {
    const R = refOf({}, 4); const a = observe(R, E); const b = observe(R, E); expect(a).toEqual(b);
  });
});
