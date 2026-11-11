import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { checkHairDome, checkHairShape, DOME_LIMITS, faceSweepEdges, shoulderRatio } from '../src/verify';
import { smoothMin } from '../src/face/hair/boundary/shell';

const seeds = Array.from({ length: 40 }, (_, i) => 9000 + i * 71);
const face = (style: string, seed: number) => generateRandomFace(seed, { hair: { style } as never, hairEngine: 'v2' });
const failing = (cs: { ok: boolean; severity: string; id: string }[]): string[] => cs.filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);

describe('épaule du dôme, sous-couche et balayage du visage (docs/HAIR-DOME-ROUND.md, docs/HAIR-FIT-SIDE.md)', () => {
  it.each(['afro', 'curly', 'bob', 'long', 'short', 'spiky'])('%s : aucun contrôle d\'erreur du dôme n\'échoue', (style) => {
    for (const sd of seeds) expect(failing(checkHairDome(face(style, sd))), `${style} ${sd}`).toEqual([]);
  });

  it('afro : la portée au-delà du crâne (limite 0,6) est respectée sur les 40 visages (11 sur 40 la dépassaient)', () => {
    for (const sd of seeds) {
      const c = checkHairShape(face('afro', sd)).find((x) => x.id === 'hair-reach-beyond-skull')!;
      expect(c.value, `afro ${sd}`).toBeLessThanOrEqual(c.limit);
    }
  });

  it('bob 9568 (régression) : ni bande à travers le visage ni peau recouverte au-delà de 0,02', () => {
    const f = face('bob', 9568), lm = faceLandmarks(f.params, f.width, f.height), g = hairGeometry(f.params, lm)!;
    expect(faceSweepEdges(g, lm.W, lm.browLimitY)).toBe(0);
    const c = checkHairShape(f).find((x) => x.id === 'hair-covers-face-skin')!;
    expect(c.value).toBeLessThanOrEqual(c.limit);
  });

  it('contre-épreuve : une arête qui traverse le visage sous les sourcils est détectée', () => {
    const f = face('bob', 9568), lm = faceLandmarks(f.params, f.width, f.height), g = hairGeometry(f.params, lm)!;
    const y = lm.browLimitY + 0.2 * lm.H;
    const bad = { x: -0.45 * lm.W, y }, bad2 = { x: 0.45 * lm.W, y: y + 3 }, bad3 = { x: 0.45 * lm.W, y: y + 40 };
    const locks = [...g.locks, { ...g.locks.find((l) => l.layer === 'front')!, poly: [bad, bad2, bad3] }];
    expect(faceSweepEdges({ ...g, locks }, lm.W, lm.browLimitY)).toBeGreaterThan(DOME_LIMITS.sweepMax);
  });

  it('afro : l\'épaule est arrondie (rapport demi-largeur au sommet / maximale ≤ limite)', () => {
    for (const sd of seeds) {
      const f = face('afro', sd), lm = faceLandmarks(f.params, f.width, f.height);
      expect(shoulderRatio(hairGeometry(f.params, lm)!, lm.H), `afro ${sd}`).toBeLessThanOrEqual(DOME_LIMITS.shoulder);
    }
  });

  it('smoothMin : égal au minimum loin du croisement, jamais au-dessus, au plus s·ln2 en dessous', () => {
    for (const [a, b] of [[10, 100], [100, 10], [50, 50], [49, 51]] as const) {
      const v = smoothMin(a, b, 5);
      expect(v).toBeLessThanOrEqual(Math.min(a, b) + 1e-9);
      expect(v).toBeGreaterThanOrEqual(Math.min(a, b) - 5 * Math.LN2 - 1e-9);
    }
    expect(smoothMin(10, 1000, 5)).toBeCloseTo(10, 6);
  });
});
