import { describe, expect, it } from 'vitest';
import { bladeOutline } from '../src/hair-grammar/blade';
import { fillPoly, makeGrid } from '../src/hair-grammar/compose-grid';
import { generate } from '../src/hair-grammar/grammar';
import { applyIntent, PRESETS } from '../src/hair-grammar/intent';
import { segmentStrands } from '../src/hair-grammar/observe-strands';
import type { Reference } from '../src/hair-grammar/observe';
import { paintLock, type PaintedLock } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { headEllipse, referenceFromPainted } from '../src/hair-grammar/reference-fit';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/** Segmentation PAR MÈCHE d'un raster, validée contre la VÉRITÉ TERRAIN du moteur (on connaît chaque mèche). Voir `observe-strands.ts` et `docs/HAIR-PASS4.md`. */
const V = viewAt(0); const W = 156; const Hh = 150; const E = headEllipse(TOUSLED, V);

function truth(painted: readonly PaintedLock[]): Int32Array {
  const lab = new Int32Array(W * Hh).fill(-1); const g = makeGrid(W, Hh, 1);
  for (const layer of ['back', 'front', 'over'] as const) painted.forEach((p, i) => { if (p.layer !== layer) return; g.data.fill(0); fillPoly(g, bladeOutline(p.blade), 1); for (let k = 0; k < W * Hh; k++) if (g.data[k]) lab[k] = i; });
  return lab;
}
const scene = (I: object, seed: number): { pl: PaintedLock[]; R: Reference } => { const P = applyIntent(TOUSLED, I).profile; const pl = generate(P, seed).map((L) => paintLock(P.head, L, V)); return { pl, R: referenceFromPainted(pl, W, Hh) }; };

function score(pl: PaintedLock[], R: Reference): { recall: number; precision: number; purity: number; count: number; visible: number } {
  const S = segmentStrands(R, E); const T = truth(pl); const area = new Map<number, number>(); const inter = new Map<string, number>(); const cA = new Array<number>(S.count).fill(0);
  for (let k = 0; k < W * Hh; k++) { const t = T[k] as number; const c = S.labels[k] as number; if (t >= 0) area.set(t, (area.get(t) ?? 0) + 1); if (c >= 0) cA[c]!++; if (c >= 0 && t >= 0) inter.set(`${t}|${c}`, (inter.get(`${t}|${c}`) ?? 0) + 1); }
  const minA = Math.max(6, 0.0035 * Math.PI * E.rx * E.ry); const vis = [...area].filter(([, a]) => a >= minA).map(([i]) => i); const used = new Set<number>(); let matched = 0; let pure = 0;
  for (const t of vis) { let best = 0; let bc = -1; for (let c = 0; c < S.count; c++) { const x = inter.get(`${t}|${c}`) ?? 0; const iou = x / ((area.get(t) as number) + (cA[c] as number) - x); if (iou > best) { best = iou; bc = c; } } if (best >= 0.5) { matched++; used.add(bc); } }
  for (let c = 0; c < S.count; c++) { let m = 0; for (let t = 0; t < pl.length; t++) m = Math.max(m, inter.get(`${t}|${c}`) ?? 0); pure += m / Math.max(1, cA[c] as number); }
  return { recall: matched / Math.max(1, vis.length), precision: used.size / Math.max(1, S.count), purity: pure / Math.max(1, S.count), count: S.count, visible: vis.length };
}

describe('segmentation par mèche : cas élémentaires (vérité connue)', () => {
  const rect = (x0: number, x1: number): Reference => { const mask = new Uint8Array(W * Hh); const gray = new Float32Array(W * Hh).fill(1); for (let y = 30; y < 120; y++) for (let x = x0; x < x1; x++) { mask[y * W + x] = 1; gray[y * W + x] = x === x0 || x === x1 - 1 ? 0.08 : 0.9; } return { w: W, h: Hh, mask, gray }; };
  it('une bande entourée d\'encre = UNE mèche ; trois bandes séparées par un trait d\'encre = TROIS', () => {
    expect(segmentStrands(rect(60, 72), E).count).toBe(1);
    const r = rect(40, 100); for (const x of [60, 80]) for (let y = 30; y < 120; y++) r.gray[y * W + x] = 0.08;
    expect(segmentStrands(r, E).count).toBe(3);
  });
  it('sans trait ni ombre entre deux bandes de même ton : UNE seule composante (sous-segmentation documentée, jamais de coupe inventée)', () => {
    const r = rect(40, 100); for (let y = 30; y < 120; y++) for (let x = 41; x < 99; x++) r.gray[y * W + x] = 0.9; expect(segmentStrands(r, E).count).toBe(1);
  });
  it('largeur estimée d\'une bande de 12 px à ±25 % (rapportée à rx) ; longueur 90 px à ±15 %', () => {
    const s = segmentStrands(rect(60, 72), E).strands[0]!; expect(Math.abs(s.width * E.rx - 12)).toBeLessThan(3); expect(Math.abs(s.length * E.rx - 90)).toBeLessThan(13.5);
  });
  it('masque vide → aucune mèche, couverture nulle', () => {
    const z = { w: W, h: Hh, mask: new Uint8Array(W * Hh), gray: new Float32Array(W * Hh) }; const a = segmentStrands(z, E); expect(a.count).toBe(0); expect(a.coverage).toBe(0);
  });
});

describe('segmentation par mèche : coiffures du moteur contre vérité terrain', () => {
  const rows = [{}, PRESETS.heavy].flatMap((I) => [1, 2, 3].map((seed) => { const { pl, R } = scene(I, seed); return score(pl, R); }));
  it('rappel moyen ≥ 0,4 (mèches visibles retrouvées à IoU ≥ 0,5), précision ≥ 0,5, pureté ≥ 0,75 (mesuré : 0,53 / 0,63 / 0,86)', () => {
    const m = (k: 'recall' | 'precision' | 'purity'): number => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    expect(m('recall')).toBeGreaterThanOrEqual(0.4); expect(m('precision')).toBeGreaterThanOrEqual(0.5); expect(m('purity')).toBeGreaterThanOrEqual(0.75);
  });
  it('le nombre de composantes est du même ordre que celui de mèches VISIBLES (0,6 – 1,4×), pas du nombre de LockSpec (qui en compte aussi d\'enfouies)', () => {
    for (const r of rows) { expect(r.count / r.visible).toBeGreaterThan(0.6); expect(r.count / r.visible).toBeLessThan(1.4); }
  });
  it('déterministe, étiquettes cohérentes avec le décompte, couverture dans [0,1]', () => {
    const { R } = scene({}, 1); const a = segmentStrands(R, E); const b = segmentStrands(R, E); expect(a.labels).toEqual(b.labels);
    expect(Math.max(...a.labels)).toBe(a.count - 1); expect(a.coverage).toBeGreaterThan(0.5); expect(a.coverage).toBeLessThanOrEqual(1);
  });
  it('plus de mèches → plus de composantes : une coiffure lourde (72) en compte davantage qu\'un volume −1 (50, plus fin)', () => {
    expect(segmentStrands(scene(PRESETS.heavy, 2).R, E).count).toBeGreaterThan(segmentStrands(scene({ volume: -1 }, 2).R, E).count);
  });
});
