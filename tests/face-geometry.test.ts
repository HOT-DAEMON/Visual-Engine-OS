import { describe, expect, it } from 'vitest';
import { FaceParams } from '../src/schema';
import { faceLandmarks, halfWidthAt, headOutline, rightSamples } from '../src/face';

const P = FaceParams.parse({});

describe('contour du visage', () => {
  const o = headOutline(P, 300, 400);
  const samples = rightSamples(o);
  it('reste dans la boîte [-W/2,W/2]×[-H/2,H/2] et touche le sommet et le menton', () => {
    for (const v of samples) {
      expect(v.x).toBeGreaterThanOrEqual(-1e-9);
      expect(v.x).toBeLessThanOrEqual(150 + 1e-9);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(200 + 1e-9);
    }
    expect(samples[0]).toEqual({ x: 0, y: -200 });
    expect(samples[samples.length - 1]?.y).toBeCloseTo(200, 9);
  });
  it('est le plus large aux temples et se rétrécit vers le menton', () => {
    const templeY = -200 + P.templeY * 400;
    expect(halfWidthAt(o, templeY)).toBeCloseTo(150, 6);
    expect(halfWidthAt(o, 0)).toBeLessThanOrEqual(150 + 1e-9);
    expect(halfWidthAt(o, 150)).toBeLessThan(halfWidthAt(o, 20));
    expect(halfWidthAt(o, 250)).toBe(0);
  });
});

describe('repères', () => {
  it('canthi symétriques sur la ligne des yeux, nez au-dessus de la bouche', () => {
    const lm = faceLandmarks(P, 300, 400);
    expect(lm.innerCanthus.left.x).toBe(-lm.innerCanthus.right.x);
    expect(lm.innerCanthus.left.y).toBe(lm.eyeY);
    expect(lm.mouthY).toBeGreaterThan(lm.noseBaseY);
    expect(lm.mouthY).toBeLessThan(lm.chinY);
  });
  it('mettre le visage à l\'échelle conserve les proportions', () => {
    const a = faceLandmarks(P, 300, 400);
    const b = faceLandmarks(P, 600, 800);
    expect(b.eyeY).toBeCloseTo(2 * a.eyeY, 9);
    expect(b.innerCanthus.right.x).toBeCloseTo(2 * a.innerCanthus.right.x, 9);
  });
});
