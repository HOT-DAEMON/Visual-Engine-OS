import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { FULL_PROGRAM, evalProgram, segLift, segTheta, validProgram } from '../src/hair-grammar/curve-program';
import { DEFAULT_HEAD } from '../src/hair-grammar/head';
import { walk, type LockSpec } from '../src/hair-grammar/lock';
import { GAP_MIN, relationsOf, resolveOrder } from '../src/hair-grammar/occlusion';
import { renderResolved } from '../src/hair-grammar/occlusion-paint';
import { paintLock, type PaintedLock } from '../src/hair-grammar/paint';
import { v3 } from '../src/hair-grammar/vec';
import { weaveStrands } from '../src/hair-grammar/weave';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * ENTRELACS ÉCRIT PAR LE MOTEUR (docs/HAIR-WEAVE.md) : `weaveStrands` pose des brins de phases décalées ; leur alternance devant/derrière vient de
 * la géométrie (cap + décollement oscillants), lue ensuite par l'occlusion locale. Rien n'est fabriqué à la main.
 */
const H = DEFAULT_HEAD; const V = viewAt(0);
const BASE: LockSpec = { id: 'B', family: 'demo', root: { el: 62, az: -20 }, aim: v3(0, 1, 0.05), length: 1.0, bend: 0, wave: { amp: 0, freq: 1, phase: 0 }, flick: { amt: 0, len: 0.2 }, lift0: 0.05, lift1: 0.2, liftPow: 1.3, gravity: 0.05, width: 0.12, peak: 0.4, taper: 1.3, tone: 0, strands: 0, layer: 'front' };
const strands = (n: number, lift = 0.03, extra: Partial<Parameters<typeof weaveStrands>[2]> = {}): PaintedLock[] => weaveStrands(H, BASE, { strands: n, spread: 0.06, freq: 2, lift, ...extra }).map((s) => paintLock(H, s, V));

describe('segment weave : cap et décollement', () => {
  const s = { kind: 'weave', len: 1, amp: 0.5, freq: 2, phase: 0.25, lift: 0.04 } as const;
  it('continuité : θ(0) = 0 et net nul sur un nombre entier de périodes', () => {
    expect(segTheta(s, 0)).toBeCloseTo(0, 12); expect(segTheta(s, 1)).toBeCloseTo(0, 9);
    expect(segTheta({ ...s, phase: 0 }, 1)).toBeCloseTo(0, 9);
  });
  it('le cap ABSOLU (direction tournée de α incluse) est centré : moyenne nulle sur la longueur', () => {
    const phase = 0.1; const alpha = 0.5 * Math.cos(2 * Math.PI * phase); const g = { ...s, phase };
    const mean = Array.from({ length: 400 }, (_, i) => alpha + segTheta(g, i / 399)).reduce((a, b) => a + b, 0) / 400;
    expect(Math.abs(mean)).toBeLessThan(0.01);
  });
  it('décollement : nul aux deux bouts (pas de saut de profondeur), oscillant à l\'intérieur, nul hors entrelacs', () => {
    expect(segLift(s, 0)).toBeCloseTo(0, 12); expect(segLift(s, 1)).toBeCloseTo(0, 9);
    const v = Array.from({ length: 100 }, (_, i) => segLift(s, i / 99)); expect(Math.max(...v)).toBeGreaterThan(0.02); expect(Math.min(...v)).toBeLessThan(-0.02);
    expect(segLift({ kind: 'straight', len: 1 }, 0.5)).toBe(0); expect(evalProgram([{ kind: 'straight', len: 1 }], 0.5).lift).toBe(0);
    expect(evalProgram(FULL_PROGRAM, 0.5).lift).toBe(0);
  });
  it('programme valide ; deux brins en opposition de phase ont des décollements opposés', () => {
    expect(validProgram([s])).toBe(true);
    for (const u of [0.1, 0.3, 0.6, 0.9]) expect(segLift({ ...s, phase: 0 }, u) + segLift({ ...s, phase: 0.5 }, u)).toBeCloseTo(0, 12);
  });
});

describe('weaveStrands : géométrie', () => {
  it('2 brins : même racine ou presque, ils s\'écartent puis se recroisent (écart latéral qui change de signe)', () => {
    const [A, B] = strands(2) as [PaintedLock, PaintedLock]; const n = A.blade.spine.length;
    const sep = (k: number): number => A.blade.spine[k]!.x - B.blade.spine[k]!.x;
    expect(Math.abs(sep(0))).toBeLessThan(2); // racines voisines
    let signChanges = 0; for (let k = 2; k < n - 1; k++) if (Math.sign(sep(k)) !== Math.sign(sep(k - 1)) && Math.abs(sep(k)) > 0.05) signChanges++;
    expect(signChanges).toBeGreaterThanOrEqual(2);
  });
  it('le groupe porte une étiquette commune et reste hors du crâne (décollement > 0 partout)', () => {
    const specs = weaveStrands(H, BASE, { strands: 3, spread: 0.06, freq: 2 });
    expect(new Set(specs.map((s) => s.weave)).size).toBe(1); expect(specs[0]!.weave).toBe('B-weave');
    for (const s of specs) for (let k = 0; k <= 28; k++) { /* walk ne lève pas et reste fini */ const p = walk(H, s)[k]!.p; expect(Number.isFinite(p.x + p.y + p.z)).toBe(true); }
  });
  it('amplitude latérale : proportionnelle à `spread`', () => {
    const width = (sp: number): number => { const [A, B] = weaveStrands(H, BASE, { strands: 2, spread: sp, freq: 2 }).map((s) => paintLock(H, s, V)); return Math.max(...A!.blade.spine.map((p, k) => Math.abs(p.x - B!.blade.spine[k]!.x))); };
    expect(width(0.09) / width(0.045)).toBeGreaterThan(1.6);
  });
});

describe('weaveStrands : occlusion locale lue dans la géométrie', () => {
  it('2 brins : relation « cross », intervalles forts ALTERNÉS (a puis b), ordre entrelacé', () => {
    const P = strands(2); const r = relationsOf(P); expect(r).toHaveLength(1); expect(r[0]!.kind).toBe('cross');
    const strong = r[0]!.intervals.filter((i) => i.gap >= GAP_MIN).sort((x, y) => x.a0 - y.a0);
    const fronts = strong.map((i) => i.front); expect(fronts).toContain('a'); expect(fronts).toContain('b');
    expect(resolveOrder(P).interleaved).toEqual([0, 1]);
  });
  it('ABLATION : sans oscillation de décollement, les mêmes brins se croisent dans le plan mais SANS alternance (simple recouvrement)', () => {
    const r = relationsOf(strands(2, 0)); expect(r[0]!.kind).toBe('overlap'); expect(resolveOrder(strands(2, 0)).interleaved).toEqual([]);
  });
  it('3 brins (tresse) : les trois paires se croisent et sont entrelacées', () => {
    const P = strands(3); const r = relationsOf(P); expect(r).toHaveLength(3); expect(r.every((x) => x.kind === 'cross')).toBe(true); expect(resolveOrder(P).interleaved).toEqual([0, 1, 2]);
  });
  it('déterministe : mêmes entrées → mêmes brins', () => {
    expect(JSON.stringify(weaveStrands(H, BASE, { strands: 3, spread: 0.06 }))).toBe(JSON.stringify(weaveStrands(H, BASE, { strands: 3, spread: 0.06 })));
  });
});

describe('weaveStrands : rendu — le brin de devant ALTERNE aux croisements', () => {
  const W = 156; const H2 = 150;
  const pix = (svg: string): ((x: number, y: number) => [number, number, number]) => { const r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H2}" viewBox="0 0 ${W} ${H2}"><rect width="100%" height="100%" fill="#fff"/>${svg}</svg>`, { fitTo: { mode: 'width', value: W * 4 } }).render(); const d = r.pixels; return (x, y) => { const i = (Math.round(y * 4) * r.width + Math.round(x * 4)) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!]; }; };
  /** Brin A en rouge vif, brin B en bleu vif (couleurs forcées dans le SVG peint : seule la pile de dessin décide qui est visible). */
  const tint = (p: PaintedLock, c: string): PaintedLock => ({ ...p, svg: p.svg.replace(/fill="[^"]*"/g, `fill="${c}"`).replace(/stroke="[^"]*"/g, 'stroke="none"') });
  const P = strands(2).map((p, i) => tint(p, i === 0 ? '#ff0000' : '#0000ff'));
  const at = pix(renderResolved(P).front);
  const [A, B] = P as [PaintedLock, PaintedLock];
  /** Croisements de l'axe : changements de signe de l'écart A − B (pris aux échantillons). */
  const crossings = (): { x: number; y: number }[] => { const out: { x: number; y: number }[] = []; for (let k = 4; k < A.blade.spine.length - 1; k++) { const s0 = A.blade.spine[k - 1]!.x - B.blade.spine[k - 1]!.x; const s1 = A.blade.spine[k]!.x - B.blade.spine[k]!.x; if (Math.sign(s0) !== Math.sign(s1)) out.push({ x: (A.blade.spine[k]!.x + B.blade.spine[k]!.x) / 2, y: (A.blade.spine[k]!.y + B.blade.spine[k]!.y) / 2 }); } return out; };
  const red = (c: number[]): boolean => c[0]! > 200 && c[2]! < 80; const blue = (c: number[]): boolean => c[2]! > 200 && c[0]! < 80;
  it('au moins deux croisements, et la couleur visible y ALTERNE (rouge puis bleu, ou l\'inverse)', () => {
    const X = crossings(); expect(X.length).toBeGreaterThanOrEqual(2);
    const vis = X.map((p) => (red(at(p.x, p.y)) ? 'A' : blue(at(p.x, p.y)) ? 'B' : '?'));
    expect(vis).not.toContain('?');
    for (let i = 1; i < vis.length; i++) expect(vis[i]).not.toBe(vis[i - 1]);
  });
  it('sans entrelacs (ordre du dessinateur seul), le même brin reste devant à TOUS les croisements', () => {
    const flat = strands(2, 0).map((p, i) => tint(p, i === 0 ? '#ff0000' : '#0000ff')); const a = pix(renderResolved(flat).front);
    const X = crossings(); const vis = X.map((p) => (red(a(p.x, p.y)) ? 'A' : blue(a(p.x, p.y)) ? 'B' : '?'));
    expect(new Set(vis).size).toBe(1);
  });
});
