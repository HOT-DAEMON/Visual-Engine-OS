import { describe, expect, it } from 'vitest';
import { eyeballRadius, foreshortenTransform, gazeOf, projectGaze } from '../src/lighting/gaze3d';
import { EyeSpec } from '../src/schema';

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });

describe('projectGaze', () => {
  it('regard de face : aucun décalage, foreshortening = 1', () => {
    const g = projectGaze(0, 0, 100, 1);
    expect(g.dx).toBeCloseTo(0, 9);
    expect(g.dy).toBeCloseTo(0, 9);
    expect(g.foreshortening).toBeCloseTo(1, 9);
  });

  it('yaw seul : décalage horizontal, aucun décalage vertical', () => {
    const g = projectGaze(30, 0, 100, 1);
    expect(g.dx).toBeGreaterThan(0);
    expect(g.dy).toBeCloseTo(0, 9);
    expect(g.foreshortening).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 9);
  });

  it('pitch seul : décalage vertical, aucun décalage horizontal', () => {
    const g = projectGaze(0, -20, 100, 1);
    expect(g.dy).toBeLessThan(0);
    expect(g.dx).toBeCloseTo(0, 9);
  });

  it('yaw négatif => décalage opposé (symétrie)', () => {
    const a = projectGaze(25, 10, 100, 1);
    const b = projectGaze(-25, 10, 100, 1);
    expect(b.dx).toBeCloseTo(-a.dx, 9);
    expect(b.dy).toBeCloseTo(a.dy, 9);
    expect(b.foreshortening).toBeCloseTo(a.foreshortening, 9);
  });

  it('le foreshortening décroît strictement avec l\'angle, et jamais en dessous du plancher', () => {
    let prev = 1;
    for (const a of [0, 10, 20, 30, 40, 45]) {
      const g = projectGaze(a, 0, 100, 1);
      expect(g.foreshortening).toBeLessThanOrEqual(prev + 1e-9);
      expect(g.foreshortening).toBeGreaterThanOrEqual(0.05);
      prev = g.foreshortening;
    }
  });

  it('travel amplifie linéairement le décalage sans changer le foreshortening', () => {
    const g1 = projectGaze(20, 15, 100, 1);
    const g2 = projectGaze(20, 15, 100, 1.5);
    expect(g2.dx).toBeCloseTo(g1.dx * 1.5, 6);
    expect(g2.dy).toBeCloseTo(g1.dy * 1.5, 6);
    expect(g2.foreshortening).toBeCloseTo(g1.foreshortening, 9);
  });

  it('radius=0 => décalage nul quel que soit l\'angle', () => {
    const g = projectGaze(40, -30, 0, 1);
    expect(g.dx).toBeCloseTo(0, 9);
    expect(g.dy).toBeCloseTo(0, 9);
  });
});

describe('eyeballRadius / gazeOf', () => {
  it('le rayon suit la hauteur de l\'œil', () => {
    const small = eye({ shape: { height: 100 } });
    const big = eye({ shape: { height: 200 } });
    expect(eyeballRadius(big)).toBeCloseTo(eyeballRadius(small) * 2, 9);
  });

  it('gazeOf combine correctement gaze.yawDeg/pitchDeg/travel avec le rayon de l\'œil', () => {
    const e = eye({ shape: { height: 100 }, gaze: { yawDeg: 20, pitchDeg: 0, travel: 1 } });
    const g = gazeOf(e);
    const expected = projectGaze(20, 0, eyeballRadius(e), 1);
    expect(g).toEqual(expected);
  });
});

describe('foreshortenTransform', () => {
  it('regard de face => chaîne vide (identité, pas de transform inutile)', () => {
    expect(foreshortenTransform(10, 20, { dx: 0, dy: 0, foreshortening: 1, tiltDeg: 0 })).toBe('');
  });

  it('applique bien scale(f,1) le long de tiltDeg=0, centré sur (cx,cy)', () => {
    const t = foreshortenTransform(0, 0, { dx: 5, dy: 0, foreshortening: 0.7, tiltDeg: 0 });
    expect(t).toContain('scale(0.7 1)');
  });
});
