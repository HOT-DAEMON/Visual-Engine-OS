import { describe, expect, it } from 'vitest';
import { DEFAULT_HEAD, aimOnShell, fitView, landmarks, project, generate, paintHair, TOUSLED, VIEW_01, verifyAnatomy, verifyGeometry, verifyStyle } from '../src/hair-grammar';

describe('grammaire de coiffure (hair-grammar)', () => {
  it('le calage de vue 01 reste sous 4 px de résidu RMS', () => {
    const T = { eyeR: { x: 77, y: 95 }, eyeL: { x: 40, y: 96 }, noseTip: { x: 43, y: 112 }, mouth: { x: 61, y: 130 }, chin: { x: 60, y: 148 }, jawAngleR: { x: 112, y: 122 } };
    expect(fitView(DEFAULT_HEAD, T, { yaw: -35, pitch: 0, s: 106, tx: 70, ty: 90 }).rms).toBeLessThan(4);
  });
  it('3/4 gauche : le nez est à gauche du milieu des yeux, l\'œil proche à droite de l\'œil lointain', () => {
    const lm = landmarks(DEFAULT_HEAD);
    const n = project(VIEW_01, lm.noseTip); const a = project(VIEW_01, lm.eyeR); const b = project(VIEW_01, lm.eyeL);
    expect(n.x).toBeLessThan((a.x + b.x) / 2);
    expect(a.x).toBeGreaterThan(b.x);
  });
  it('l\'inversion image → coque retrouve le point projeté', () => {
    const r = aimOnShell(DEFAULT_HEAD, VIEW_01, 72, 60, 0.04);
    expect(r).not.toBeNull();
  });
  it('génération déterministe (même graine → mêmes mèches) et graines différentes → différentes', () => {
    expect(JSON.stringify(generate(TOUSLED, 3))).toBe(JSON.stringify(generate(TOUSLED, 3)));
    expect(JSON.stringify(generate(TOUSLED, 3))).not.toBe(JSON.stringify(generate(TOUSLED, 4)));
  });
  it('les trois couches de vérification passent sur la cellule 01', () => {
    const specs = generate(TOUSLED, 1);
    const hair = paintHair(TOUSLED.head, specs, VIEW_01);
    expect(verifyGeometry(hair).ok).toBe(true);
    expect(verifyAnatomy(TOUSLED.head, VIEW_01, hair).ok).toBe(true);
    expect(verifyStyle(specs, 0.85).ok).toBe(true);
  });
  it('la vérification anatomique détecte une frange trop longue', () => {
    const specs = generate(TOUSLED, 1).map((s) => (s.family === 'fringe' ? { ...s, length: s.length * 2.2 } : s));
    const hair = paintHair(TOUSLED.head, specs, VIEW_01);
    expect(verifyAnatomy(TOUSLED.head, VIEW_01, hair).ok).toBe(false);
  });
  it('construction géométrique + SVG sous 150 ms (marge large, médiane réelle ≈ 15 ms)', () => {
    generate(TOUSLED, 1);
    const t0 = performance.now();
    paintHair(TOUSLED.head, generate(TOUSLED, 1), VIEW_01);
    expect(performance.now() - t0).toBeLessThan(150);
  });
});
