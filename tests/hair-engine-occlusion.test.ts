import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { smoothPath, bladeOutline, type Blade } from '../src/hair-grammar/blade';
import { relationsOf, resolveOrder, visibleSpans, GAP_MIN } from '../src/hair-grammar/occlusion';
import { renderResolved } from '../src/hair-grammar/occlusion-paint';
import type { LockSpec } from '../src/hair-grammar/lock';
import type { PaintedLock } from '../src/hair-grammar/paint';
import type { V2 } from '../src/hair-grammar/vec';
import { v3 } from '../src/hair-grammar/vec';

/** Lame fabriquée à la main : axe donné, demi-largeur constante, profondeur donnée par t. */
const N = 40;
function synth(id: string, axis: (t: number) => V2, depth: (t: number) => number, fill: string, half = 4, parent?: string, weave?: string): PaintedLock {
  const spine: V2[] = []; const left: V2[] = []; const right: V2[] = [];
  for (let i = 0; i < N; i++) { const t = i / (N - 1); spine.push(axis(t)); }
  for (let i = 0; i < N; i++) { const a = spine[Math.max(0, i - 1)]!; const b = spine[Math.min(N - 1, i + 1)]!; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; const dx = (b.x - a.x) / l; const dy = (b.y - a.y) / l; const p = spine[i]!; left.push({ x: p.x - dy * half, y: p.y + dx * half }); right.push({ x: p.x + dy * half, y: p.y - dx * half }); }
  const blade: Blade = { spine, half: spine.map(() => half), left, right, facing: spine.map(() => 1), t: spine.map((_, i) => i / (N - 1)), depth: spine.map((_, i) => depth(i / (N - 1))), twist: spine.map(() => 0) };
  const spec = { id, family: 's', root: { el: 0, az: 0 }, aim: v3(0, 1, 0), length: 1, bend: 0, wave: { amp: 0, freq: 1, phase: 0 }, flick: { amt: 0, len: 0 }, lift0: 0, lift1: 0, liftPow: 1, gravity: 0, width: 0.1, peak: 0.4, taper: 1, tone: 0, strands: 0, layer: 'front', ...(parent ? { parent: { id: parent, t: 0.5 } } : {}), ...(weave ? { weave } : {}) } as LockSpec;
  return { spec, blade, layer: 'front', svg: `<path d="${smoothPath(bladeOutline(blade), true)}" fill="${fill}"/>` };
}
const W = 100;
const px = (svg: string): { rgba: Uint8Array; at: (x: number, y: number) => [number, number, number, number] } => { const r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}"><rect width="100%" height="100%" fill="#fff"/>${svg}</svg>`, { fitTo: { mode: 'width', value: W * 4 } }).render(); const d = r.pixels; return { rgba: d, at: (x, y) => { const i = (Math.round(y * 4) * r.width + Math.round(x * 4)) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]; } }; };
const isRed = (c: number[]): boolean => c[0]! > 200 && c[1]! < 60 && c[2]! < 60;
const isBlue = (c: number[]): boolean => c[2]! > 200 && c[0]! < 60 && c[1]! < 60;

// Deux rubans en tresse : A = sinus, B = son opposé ; ils se croisent en t = 1/3 et t = 2/3.
const ax = (t: number): V2 => ({ x: 10 + 80 * t, y: 50 - 22 * Math.sin(3 * Math.PI * t) });
const bx = (t: number): V2 => ({ x: 10 + 80 * t, y: 50 + 22 * Math.sin(3 * Math.PI * t) });
// A passe devant au 1er croisement, B au 2e : la profondeur de A − celle de B change de signe entre les deux.
const dA = (t: number): number => 1 - t; const dB = (t: number): number => t;
const braid = (): PaintedLock[] => [synth('A', ax, dA, '#ff0000', 4, undefined, 'tresse'), synth('B', bx, dB, '#0000ff', 4, undefined, 'tresse')];
const X1 = ax(1 / 3); const X2 = ax(2 / 3);

describe('grammaire de chevauchement : occlusion locale', () => {
  it('relations : deux rubans qui se croisent deux fois sont un CROISEMENT, avec intervalles alternés devant/derrière', () => {
    const r = relationsOf(braid());
    expect(r).toHaveLength(1);
    expect(r[0]!.kind).toBe('cross');
    const fa = r[0]!.intervals.filter((i) => i.front === 'a' && i.gap >= GAP_MIN); const fb = r[0]!.intervals.filter((i) => i.front === 'b' && i.gap >= GAP_MIN);
    expect(fa.length).toBeGreaterThan(0); expect(fb.length).toBeGreaterThan(0);
    const mid = (i: { a0: number; a1: number }): number => (i.a0 + i.a1) / 2;
    expect(Math.max(...fa.map(mid))).toBeLessThan(0.5); expect(Math.min(...fb.map(mid))).toBeGreaterThan(0.5);
  });
  it('chaque intervalle dit où le recouvrement COMMENCE et où il FINIT, sur les deux mèches', () => {
    for (const iv of relationsOf(braid())[0]!.intervals) { expect(iv.a0).toBeLessThanOrEqual(iv.a1); expect(iv.b0).toBeLessThanOrEqual(iv.b1); for (const v of [iv.a0, iv.a1, iv.b0, iv.b1]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
  });
  it('peinture : le dessinateur simple met B sur A aux DEUX croisements ; l\'occlusion locale alterne (A devant puis B devant)', () => {
    const simple = px(braid().map((p) => p.svg).join(''));
    expect(isBlue(simple.at(X1.x, X1.y))).toBe(true); expect(isBlue(simple.at(X2.x, X2.y))).toBe(true);
    const res = px(renderResolved(braid()).front);
    expect(isRed(res.at(X1.x, X1.y))).toBe(true);
    expect(isBlue(res.at(X2.x, X2.y))).toBe(true);
  });
  it('la silhouette d\'ensemble est INTACTE : même masque d\'alpha que le dessinateur simple (< 0,3 % de pixels différents)', () => {
    const a = px(braid().map((p) => p.svg).join('')).rgba; const b = px(renderResolved(braid()).front).rgba;
    let diff = 0; let cov = 0; for (let i = 0; i < a.length; i += 4) { const ia = a[i]! < 250 || a[i + 1]! < 250 || a[i + 2]! < 250; const ib = b[i]! < 250 || b[i + 1]! < 250 || b[i + 2]! < 250; if (ia !== ib) diff++; if (ia) cov++; }
    expect(cov).toBeGreaterThan(1000); expect(diff / cov).toBeLessThan(0.003);
  });
  it('hors groupe de tressage, un croisement garde l\'ordre de la coiffure (profondeur de coque jugée non fiable)', () => {
    const free = [synth('A', ax, dA, '#ff0000'), synth('B', bx, dB, '#0000ff')];
    expect(relationsOf(free)[0]!.kind).toBe('cross');
    expect(resolveOrder(free).interleaved).toEqual([]); expect(resolveOrder(free, relationsOf(free), 'all').interleaved).toEqual([0, 1]);
  });
  it('seules les mèches qui se croisent sont découpées ; une mèche isolée reste entière', () => {
    const lone = synth('C', (t) => ({ x: 10 + 80 * t, y: 90 }), () => 0.5, '#00aa00');
    const r = resolveOrder([...braid(), lone]);
    expect(r.order.filter((i) => i.lock === 2)).toHaveLength(1); expect(r.order.filter((i) => i.lock === 2)[0]!.whole).toBe(true);
    expect(r.order.filter((i) => i.lock < 2).every((i) => i.cut)).toBe(true);
  });
  it('ordre de dessin : une paire sans alternance garde l\'ordre de la coiffure ; le tri est stable', () => {
    const a = synth('A', (t) => ({ x: 10 + 80 * t, y: 40 }), () => 0.2, '#f00', 6); const b = synth('B', (t) => ({ x: 10 + 80 * t, y: 42 }), () => 0.9, '#00f', 6);
    const r = resolveOrder([a, b]); expect(r.order.map((i) => i.lock)).toEqual([0, 1]);
    expect(r.interleaved).toEqual([]);
  });
  it('mèche émergente : posée sous sa mère (ombre de contact, mère dessinée après)', () => {
    const mother = synth('M', (t) => ({ x: 10 + 80 * t, y: 50 }), () => 0.3, '#ff0000', 10);
    const child = synth('E', (t) => ({ x: 30 + 50 * t, y: 50 - 30 * t * t }), () => 0.9, '#0000ff', 3, 'M');
    const res = renderResolved([child, mother]); // la fille est en tête de tableau (dessinée avant par défaut) mais doit rester sous sa mère
    const rel = res.relations[0]!; expect(rel.kind).toBe('emerge');
    const order = res.resolved.order.map((i) => (i.lock === 0 ? 'child' : 'mother')); expect(order.indexOf('mother')).toBeGreaterThan(order.indexOf('child'));
    expect(isRed(px(res.front).at(40, 50))).toBe(true);
  });
  it('portions visibles : la mèche de derrière réapparaît entre les deux recouvrements', () => {
    const rel = relationsOf(braid());
    const vs = visibleSpans(0, N, rel); expect(vs.length).toBeGreaterThanOrEqual(2);
    for (const [a, b] of vs) expect(b).toBeGreaterThanOrEqual(a);
    const covered = 1 - vs.reduce((s, [a, b]) => s + (b - a), 0);
    expect(covered).toBeGreaterThan(0.02); expect(covered).toBeLessThan(0.6);
  });
  it('ombre de contact : un trait sombre apparaît sur la mèche de derrière, le long du bord de celle de devant', () => {
    const res = renderResolved(braid()); expect(res.stats.shadows).toBeGreaterThan(0);
    expect(res.front).toContain('opacity="0.3"');
  });
});
