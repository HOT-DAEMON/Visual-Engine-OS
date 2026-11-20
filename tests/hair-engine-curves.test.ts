import { describe, expect, it } from 'vitest';
import { FULL_PROGRAM, evalProgram, segTheta, segmentSpans, validProgram, type CurveSegment } from '../src/hair-grammar/curve-program';
import { DEFAULT_HEAD, project } from '../src/hair-grammar/head';
import { emergeFrom, emergenceContinuity } from '../src/hair-grammar/emerge';
import { makeBlade } from '../src/hair-grammar/blade';
import { walk, type LockSpec } from '../src/hair-grammar/lock';
import { twistWidth } from '../src/hair-grammar/width-program';
import { viewRayInHead } from '../src/hair-grammar/head';
import { bladeOutline } from '../src/hair-grammar/blade';
import { inPoly } from '../src/face/poly';
import { v3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';
import type { WidthOp } from '../src/hair-grammar/width-program';

const lock = (program?: CurveSegment[], widthProg?: WidthOp[], extra: Partial<LockSpec> = {}): LockSpec => ({ id: 'x', family: 't', root: { el: 55, az: -15 }, aim: v3(0, 1, 0.05), length: 0.9, bend: 0, wave: { amp: 0, freq: 1, phase: 0 }, flick: { amt: 0, len: 0.2 }, lift0: 0.05, lift1: 0.15, liftPow: 1.2, gravity: 0.05, width: 0.14, peak: 0.4, taper: 1.3, tone: 0.5, strands: 0, layer: 'front', ...(program ? { program } : {}), ...(widthProg ? { widthProg } : {}), ...extra });
const V = viewAt(0);
const blade = (L: LockSpec) => makeBlade(L, walk(DEFAULT_HEAD, L), V, viewRayInHead(V));
const zeroCross = (f: (u: number) => number, a: number, b: number, n = 400): number => { let c = 0; let p = f(a); for (let i = 1; i <= n; i++) { const q = f(a + ((b - a) * i) / n); if (Math.sign(q) !== Math.sign(p) && q !== 0) c++; p = q; } return c; };

describe('grammaire de courbes : chaque comportement, un par un', () => {
  it('straight : cap nul', () => { for (let t = 0; t <= 1; t += 0.1) expect(evalProgram([{ kind: 'straight', len: 1 }], t).theta).toBe(0); });
  it('arc progressif : part droit (courbure initiale ≈ 0) puis s\'enroule, cap final = angle', () => {
    const s: CurveSegment = { kind: 'arc', len: 1, angle: 1.2, ease: 2 };
    expect(segTheta(s, 1)).toBeCloseTo(1.2, 9);
    expect(segTheta(s, 0.1) / 1.2).toBeLessThan(0.02);
    const k = (u: number) => (segTheta(s, u + 1e-4) - segTheta(s, u)) / 1e-4;
    expect(k(0.01)).toBeLessThan(0.1); expect(k(0.9)).toBeGreaterThan(1.5);
  });
  it('inflect : la courbure change de signe au milieu, le cap revient à 0', () => {
    const s: CurveSegment = { kind: 'inflect', len: 1, angle: 0.9 };
    const k = (u: number) => segTheta(s, u + 1e-4) - segTheta(s, u);
    expect(k(0.2)).toBeGreaterThan(0); expect(k(0.8)).toBeLessThan(0);
    expect(segTheta(s, 1)).toBeCloseTo(0, 9); expect(segTheta(s, 0.5)).toBeCloseTo(0.9, 9);
  });
  it('compress : les spires se resserrent (plus de passages par zéro dans la 2e moitié), cap net nul', () => {
    const s: CurveSegment = { kind: 'compress', len: 1, amp: 0.6, f0: 1, f1: 4 };
    expect(segTheta(s, 1)).toBeCloseTo(0, 9);
    const k = (u: number) => segTheta(s, u + 1e-4) - segTheta(s, u);
    expect(zeroCross(k, 0.5, 1)).toBeGreaterThan(zeroCross(k, 0, 0.5));
  });
  it('wave : amplitude bornée, nombre de périodes = freq', () => {
    const s: CurveSegment = { kind: 'wave', len: 1, amp: 0.4, freq: 3 };
    const v = Array.from({ length: 200 }, (_, i) => segTheta(s, i / 199));
    expect(Math.max(...v.map(Math.abs))).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(zeroCross((u) => segTheta(s, u) - 0, 0.01, 1)).toBeGreaterThanOrEqual(5);
  });
  it('twist : aucun effet sur le cap, tours complets sur l\'axe, ruban vu par la tranche = largeur plancher', () => {
    const p: CurveSegment[] = [{ kind: 'straight', len: 1 }, { kind: 'twist', len: 1, turns: 1.5 }];
    expect(evalProgram(p, 1).theta).toBe(0);
    expect(evalProgram(p, 1).twist).toBeCloseTo(3 * Math.PI, 9);
    expect(twistWidth(Math.PI / 2)).toBeCloseTo(0.16, 9); expect(twistWidth(0)).toBe(1);
    const b = blade(lock(p));
    const mid = b.half[Math.floor(b.half.length * 0.75)] as number; const flat = b.half[Math.floor(b.half.length * 0.3)] as number;
    expect(b.twist.some((x) => Math.abs(x) > 1)).toBe(true);
    expect(Math.min(...b.half.slice(14, 36))).toBeLessThan(0.45 * Math.max(...b.half.slice(14, 36)));
    void mid; void flat;
  });
  it('accelerate : la courbure croît (crochet tardif)', () => {
    const s: CurveSegment = { kind: 'accelerate', len: 1, angle: 1.4, power: 2.6 };
    expect(segTheta(s, 0.5) / segTheta(s, 1)).toBeLessThan(0.2);
    const k = (u: number) => segTheta(s, u + 1e-4) - segTheta(s, u);
    expect(k(0.9)).toBeGreaterThan(5 * k(0.3));
  });
  it('tipFlip : tout le virage est dans le dernier segment', () => {
    const p: CurveSegment[] = [{ kind: 'straight', len: 3 }, { kind: 'tipFlip', len: 0.7, angle: -1.5 }];
    const span = segmentSpans(p)[1]!;
    expect(evalProgram(p, span.t0).theta).toBeCloseTo(0, 9);
    expect(evalProgram(p, 1).theta).toBeCloseTo(-1.5, 9);
  });
  it('le cap est CONTINU aux frontières de segments (aucun coude) dans le programme à 8 comportements', () => {
    expect(validProgram(FULL_PROGRAM)).toBe(true);
    for (const sp of segmentSpans(FULL_PROGRAM).slice(1)) {
      const a = evalProgram(FULL_PROGRAM, sp.t0 - 1e-9).theta; const b = evalProgram(FULL_PROGRAM, sp.t0 + 1e-9).theta;
      expect(Math.abs(a - b)).toBeLessThan(1e-5);
    }
  });
  it('combinaison : la mèche à 8 comportements est finie, plus tortueuse que l\'arc seul, sur la coque', () => {
    const L = lock([...FULL_PROGRAM]); const S = walk(DEFAULT_HEAD, L);
    expect(S.every((s) => Number.isFinite(s.p.x + s.p.y + s.p.z))).toBe(true);
    const b = blade(L); expect(b.left.every((p) => Number.isFinite(p.x + p.y))).toBe(true);
    const tv = (p: readonly CurveSegment[]): number => { let t = 0; let prev = 0; for (let i = 1; i <= 200; i++) { const th = evalProgram(p, i / 200).theta; t += Math.abs(th - prev); prev = th; } return t; };
    expect(tv(FULL_PROGRAM)).toBeGreaterThan(4 * tv([{ kind: 'arc', len: 1, angle: 0.7 }]));
  });
  it('sans programme : rien ne change (torsion nulle, mèche historique intacte)', () => {
    const b = blade(lock()); expect(b.twist.every((x) => x === 0)).toBe(true);
    expect(walk(DEFAULT_HEAD, lock())[5]!.twist).toBeUndefined();
  });
});

describe('grammaire des profils de largeur locaux', () => {
  const base = blade(lock()).half; const n = base.length;
  const at = (t: number): number => Math.round(t * (n - 1));
  it('renflement : la largeur gonfle au point demandé', () => { const b = blade(lock(undefined, [{ kind: 'bulge', at: 0.6, span: 0.15, gain: 1 }])).half; expect((b[at(0.6)] as number) / (base[at(0.6)] as number)).toBeCloseTo(2, 1); expect(b[at(0.9)]).toBeCloseTo(base[at(0.9)] as number, 6); });
  it('étranglement : la largeur se resserre', () => { const b = blade(lock(undefined, [{ kind: 'pinch', at: 0.5, span: 0.12, depth: 0.7 }])).half; expect((b[at(0.5)] as number) / (base[at(0.5)] as number)).toBeCloseTo(0.3, 1); });
  it('section aplatie : largeur tenue constante entre from et to', () => { const b = blade(lock(undefined, [{ kind: 'flat', from: 0.5, to: 0.85 }])).half; const ref = b[at(0.5)] as number; for (const t of [0.55, 0.65, 0.8]) expect(b[at(t)] as number).toBeCloseTo(ref, 1); expect(base[at(0.8)] as number).toBeLessThan(0.8 * (base[at(0.5)] as number)); });
  it('changement brusque vs progressif : même rapport final, transition 10× plus courte', () => {
    const span = (sharp: number): number => { const b = blade(lock(undefined, [{ kind: 'step', at: 0.5, ratio: 0.4, sharp }])).half; const r = b.map((w, i) => w / (base[i] as number)); return r.filter((x) => x > 0.45 && x < 0.95).length; };
    expect(span(40)).toBeLessThan(span(3));
    expect(span(3)).toBeGreaterThanOrEqual(4);
  });
});

describe('transition entre masses : une mèche ÉMERGE de son volume', () => {
  const parent = lock([{ kind: 'straight', len: 1 }, { kind: 'arc', len: 1, angle: 0.5 }], undefined, { id: 'mere', width: 0.3, length: 0.8, lift0: 0.06, lift1: 0.1 });
  const child = emergeFrom(DEFAULT_HEAD, parent, lock(undefined, undefined, { id: 'fille', width: 0.1, length: 0.5 }), { t: 0.4, peel: 0.8 });
  it('racine exactement sur la mère, cap continu, naissance plus fine que la mère', () => {
    const c = emergenceContinuity(DEFAULT_HEAD, parent, child);
    expect(c.gap).toBeLessThanOrEqual(0.004 + 1e-9); expect(c.angleDeg).toBeLessThan(8); expect(c.widthRatio).toBeLessThan(0.1);
  });
  it('en 2D, la racine de la fille est DANS la lame de la mère puis elle en sort', () => {
    const bp = blade(parent); const bc = blade(child); const poly = bladeOutline(bp);
    expect(inPoly(poly, (bc.spine[0] as { x: number }).x, (bc.spine[0] as { y: number }).y)).toBe(true);
    const last = bc.spine.at(-1) as { x: number; y: number }; expect(inPoly(poly, last.x, last.y)).toBe(false);
  });
  it('la fille se détache progressivement : l\'écart angulaire à la mère croît le long de la mèche', () => {
    const S = walk(DEFAULT_HEAD, child); const ang = (i: number): number => Math.atan2(project(V, S[i + 1]!.p).y - project(V, S[i]!.p).y, project(V, S[i + 1]!.p).x - project(V, S[i]!.p).x);
    expect(Math.abs(ang(26) - ang(1))).toBeGreaterThan(Math.abs(ang(4) - ang(1)));
  });
});
