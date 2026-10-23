import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src/generation/random-face';
import { faceLandmarks } from '../src/face';
import { FaceParams } from '../src/schema';
import { JAW_LIMITS, jawSilhouetteMetrics } from '../src/verify/jaw-continuity';

const lmOf = (patch: object = {}) => faceLandmarks(FaceParams.parse({ anatomyEngine: 'structured', ...patch }), 300, 400);

describe('continuité mandibule → menton (silhouette)', () => {
  it('800 visages tirés : contour convexe, pas de goutte, pointe arrondie', () => {
    for (let s = 1; s <= 800; s++) {
      const f = generateRandomFace(s, { structure: true });
      const m = jawSilhouetteMetrics(faceLandmarks(f.params, f.width, f.height));
      expect(m.concavityDeg, `graine ${s}`).toBeLessThanOrEqual(JAW_LIMITS.concavityDeg);
      expect(m.teardrop, `graine ${s}`).toBeGreaterThanOrEqual(JAW_LIMITS.teardropMin);
      expect(m.tipRadius, `graine ${s}`).toBeGreaterThanOrEqual(JAW_LIMITS.tipRadiusMin);
    }
  });

  it('paramètres extrêmes (menton très étroit, mâchoire très large, menton pointu) : toujours convexe', () => {
    for (const chinWidth of [0.1, 0.2]) for (const jawWidth of [0.8, 0.95]) for (const form of [-1, 0, 1]) {
      const m = jawSilhouetteMetrics(lmOf({ chinWidth, jawWidth, chin: { form } }));
      expect(m.concavityDeg).toBeLessThanOrEqual(JAW_LIMITS.concavityDeg);
      expect(m.teardrop).toBeGreaterThanOrEqual(JAW_LIMITS.teardropMin);
    }
  });

  it('le plancher de continuité élargit un menton trop étroit et le consigne ; au-dessus, la largeur demandée est exacte', () => {
    const narrow = lmOf({ chinWidth: 0.1, jawWidth: 0.9 });
    expect(narrow.outline.chinHalf).toBeGreaterThan(narrow.outline.chinHalfRequested);
    expect(narrow.corrections.some((c) => c.id === 'chin-continuity')).toBe(true);
    const wide = lmOf({ chinWidth: 0.4 });
    expect(wide.outline.chinHalf).toBeCloseTo(wide.outline.chinHalfRequested, 9);
  });

  it('contrôle négatif : l\'ancienne construction (menton étroit sans plancher) serait détectée', () => {
    const lm = lmOf({ chinWidth: 0.3 });
    const o = lm.outline;
    const bad = { ...lm, outline: { ...o, right: o.right.map((c, i) => (i === 3 ? { ...c, p2: { x: c.p3.x + 2, y: c.p3.y - 45 } } : c)) } };
    expect(jawSilhouetteMetrics(bad as typeof lm).concavityDeg).toBeGreaterThan(JAW_LIMITS.concavityDeg);
  });
});
