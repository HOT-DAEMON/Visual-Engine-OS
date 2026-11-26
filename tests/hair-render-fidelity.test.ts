import { describe, expect, it } from 'vitest';
import { fromHsl, resolveAppearance, toHsl, hueDelta } from '../src/appearance';
import { blueSheenWeight } from '../src/appearance/hair-light';
import type { HairLock } from '../src/face/hair';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project } from '../src/hair-grammar/head';
import { checkHairLockContract, frameFromEyes, grammarToHairLocks } from '../src/hair-grammar/interop';
import { INK_PRO, MAIN_PRO, paintHairPro, type ProStyle } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { bandZigzag, checkMainRender, edgeZigzag, litHueDrift, LIT_HUE_MAX } from '../src/hair-grammar/render-verify';
import { norm, v3 } from '../src/hair-grammar/vec';
import { Appearance } from '../src/schema';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const spec = Appearance.parse({});
const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BROWN = '#4a3326';
const scene = (style: ProStyle, yaw: number, seed: number): { locks: HairLock[]; headW: number } => {
  const H = DEFAULT_HEAD; const v = viewAt(yaw); const lm = landmarks(H); const eR = project(v, lm.eyeR); const eL = project(v, lm.eyeL); const headW = 2 * H.rx * v.s;
  const light = { dir: norm(v3(-0.45, -0.65, 0.6)) };
  return { headW, locks: grammarToHairLocks(paintHairPro(H, generate(TOUSLED, seed), v, style, light).locks as never, { frame: frameFromEyes(eR, eL, eR, eL), head: H, headW }) };
};

describe('lumière propre aux cheveux (appearance/hair-light.ts)', () => {
  it('le brun foncé #4a3326 (l = 0,219) garde un reflet de sa famille : ≤ 30° de sa teinte, contre 163° avec la dérivation par défaut', () => {
    const b = toHsl(BROWN);
    const def = resolveAppearance(BROWN, spec); const hair = resolveAppearance(BROWN, spec, { model: 'hair' });
    expect(Math.abs(hueDelta(b.h, toHsl(def.light).h))).toBeGreaterThan(120); // le défaut documenté : #7d95bf, bleu ardoise
    expect(Math.abs(hueDelta(b.h, toHsl(hair.light).h))).toBeLessThanOrEqual(30);
  });
  it('le noir garde son reflet bleuté (voulu) : identique au modèle par défaut', () => {
    for (const c of ['#1a1a1f', '#0e0e14', '#08080c']) expect(resolveAppearance(c, spec, { model: 'hair' }).light).toBe(resolveAppearance(c, spec).light);
  });
  it('toute couleur hors du noir et des bruns très sombres est inchangée au bit près', () => {
    for (const c of ['#6b3a22', '#5a3825', '#d8b868', '#a03020', '#8a8a8a', '#ff3fa4']) expect(resolveAppearance(c, spec, { model: 'hair' }).light).toBe(resolveAppearance(c, spec).light);
  });
  it('sans option, la dérivation de la peau et des yeux ne change pas (épinglé : #4a3326 → #7d95bf)', () => {
    expect(resolveAppearance(BROWN, spec).light).toBe('#7d95bf');
  });
  it('continue : plus de falaise en luminosité (saut RVB ≤ 0,06 contre 0,13–0,23 par défaut)', () => {
    for (const s of [0.1, 0.2, 0.32, 0.5]) for (const model of ['default', 'hair'] as const) {
      let prev: number[] | null = null; let mx = 0;
      for (let l = 0.05; l <= 0.45; l += 0.002) { const c = rgb(resolveAppearance(fromHsl({ h: 24, s, l }), spec, { model }).light); if (prev) mx = Math.max(mx, Math.hypot(c[0]! - prev[0]!, c[1]! - prev[1]!, c[2]! - prev[2]!) / 441); prev = c; }
      if (model === 'hair') expect(mx).toBeLessThan(0.06); else expect(mx).toBeGreaterThan(0.1);
    }
  });
  it('le poids du reflet bleuté : 1 pour un noir franc, ~0 pour un brun saturé, monotone', () => {
    expect(blueSheenWeight(0.08, 0.1)).toBe(1); expect(blueSheenWeight(0.3, 0.1)).toBe(0); expect(blueSheenWeight(0.1, 0.6)).toBe(0);
    let prev = 1; for (let l = 0.1; l <= 0.3; l += 0.01) { const w = blueSheenWeight(l, 0.2); expect(w).toBeLessThanOrEqual(prev + 1e-12); prev = w; }
  });
});

describe('détecteur de dentelure (render-verify.ts)', () => {
  it('un bord droit, un arc et un arc effilé valent 0 ; une dentelure vaut une alternance par dent', () => {
    const line = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
    const arc = Array.from({ length: 10 }, (_, i) => ({ x: i, y: -0.08 * (i - 4.5) ** 2 }));
    const saw = Array.from({ length: 10 }, (_, i) => ({ x: i, y: i % 2 ? 0.6 : -0.6 }));
    expect(edgeZigzag(line, 6)).toBe(0); expect(edgeZigzag(arc, 6)).toBe(0); expect(edgeZigzag(saw, 6)).toBeGreaterThanOrEqual(7);
  });
});

describe('rendu principal : reflets lisses (MAIN_PRO) et vérification G·A·S', () => {
  const cases: [number, number][] = [[0, 1], [0, 2], [0, 3], [-30, 2], [30, 2]];
  it('le détecteur VOIT l\'ancien défaut : les bandes à l\'encre (dents de la référence 60) sont dentelées', () => {
    const z = cases.flatMap(([yaw, seed]) => scene({ ...INK_PRO, ring: 'add' }, yaw, seed).locks.filter((l) => l.geom?.ring).map((l) => bandZigzag(l.geom!.ring!.highlight)));
    expect(z.length).toBeGreaterThan(0); expect(Math.max(...z)).toBeGreaterThan(0);
  });
  it('avec MAIN_PRO : aucune bande dentelée, contrat respecté, sur 5 vues', () => {
    let rings = 0;
    for (const [yaw, seed] of cases) {
      const { locks, headW } = scene(MAIN_PRO, yaw, seed);
      expect(checkHairLockContract(locks, headW)).toEqual([]);
      for (const l of locks) if (l.geom?.ring) { rings++; expect(bandZigzag(l.geom.ring.highlight)).toBe(0); }
      const issues = checkMainRender(locks, resolveAppearance(BROWN, spec, { model: 'hair' }));
      expect(issues).toEqual([]);
    }
    expect(rings).toBeGreaterThan(0);
  });
  it('MAIN_PRO : la bande est une lentille (bouts plus minces que le centre)', () => {
    const { locks } = scene(MAIN_PRO, 0, 2); const l = locks.find((q) => q.geom?.ring)!; const h = l.geom!.ring!.highlight; const n = h.length >> 1;
    const gap = (j: number): number => Math.hypot(h[j]!.x - h[h.length - 1 - j]!.x, h[j]!.y - h[h.length - 1 - j]!.y);
    expect(gap(0)).toBeLessThan(0.6 * gap(n >> 1));
  });
  it('style : le brun passe, l\'ancienne apparence bleutée est signalée', () => {
    const { locks } = scene(MAIN_PRO, 0, 2);
    expect(litHueDrift(resolveAppearance(BROWN, spec, { model: 'hair' }))).toBeLessThanOrEqual(LIT_HUE_MAX);
    const bad = checkMainRender(locks, resolveAppearance(BROWN, spec));
    expect(bad.map((i) => i.code)).toContain('style.lit-hue');
  });
});
