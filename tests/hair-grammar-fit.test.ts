import { describe, expect, it } from 'vitest';
import { Synth, TOUSLED, VIEW_01, boxBlur, clearBuf, distance, fillPoly, fitLocks, generate, makeBuf } from '../src/hair-grammar';
import { makeTarget01 } from '../scripts/hair-grammar/target-01';

describe('ajustement par synthèse (autofit)', () => {
  it('fillPoly remplit un rectangle à ±1 pixel près et efface l\'encre dessous', () => {
    const b = makeBuf(40, 40); b.ink.fill(1);
    fillPoly(b, [{ x: 5, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 15 }, { x: 5, y: 15 }], 3, 100, 1);
    const n = b.id.reduce((a, v) => a + (v === 3 ? 1 : 0), 0);
    expect(Math.abs(n - 200)).toBeLessThanOrEqual(20);
    expect(b.ink[10 * 40 + 10]).toBe(0);
    clearBuf(b);
    expect(b.id.every((v) => v === 0)).toBe(true);
  });
  it('la transformée en distance donne la distance à un pixel isolé (±5 %)', () => {
    const w = 31; const src = new Uint8Array(w * w); src[15 * w + 15] = 1; const out = new Float32Array(w * w);
    distance(src, w, w, out);
    expect(out[15 * w + 15]).toBe(0);
    expect(out[15 * w + 22]).toBeCloseTo(7, 5);
    expect(Math.abs((out[22 * w + 22] as number) - 9.9)).toBeLessThan(0.7);
  });
  it('le flou de boîte conserve la moyenne d\'une image constante', () => {
    const w = 20; const src = new Uint8Array(w * w).fill(80); const out = new Float32Array(w * w); const tmp = new Float64Array((w + 1) * (w + 1));
    boxBlur(src, w, w, 3, out, tmp);
    expect(out.every((v) => Math.abs(v - 80) < 1e-4)).toBe(true);
  });
  it('perte finie, déterministe ; la recherche locale (300 itérations) ne l\'augmente jamais et la fait baisser', () => {
    const { target, layer } = makeTarget01(1);
    const synth = new Synth(TOUSLED.head, VIEW_01, target, layer);
    const start = generate(TOUSLED, 1);
    synth.load(start);
    const l0 = synth.loss(); const l0b = synth.loss();
    expect(Number.isFinite(l0.total)).toBe(true);
    expect(l0b.total).toBe(l0.total);
    const res = fitLocks(TOUSLED, synth, start, { iters: 300, seed: 3, maxLocks: 80, minLocks: 30 });
    expect(res.loss.total).toBeLessThan(l0.total);
    // Même graine → même résultat (déterminisme de l'optimiseur).
    const again = fitLocks(TOUSLED, synth, start, { iters: 300, seed: 3, maxLocks: 80, minLocks: 30 });
    expect(again.loss.total).toBe(res.loss.total);
  }, 60000);
});
