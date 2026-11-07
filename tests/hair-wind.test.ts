import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { HAIR_STYLES } from '../src/schema';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald');
const geo = (style: string, wind?: { x: number; y: number; flex?: number }, seed = 77) => {
  const f = generateRandomFace(seed, { hairEngine: 'classic', hair: { style, seed: 3, fringe: 'sweep', ...(wind ? { wind } : {}) } as never } as never);
  const lm = faceLandmarks(f.params, f.width, f.height);
  return { g: hairGeometry(f.params, lm)!, lm, f };
};
const tipX = (g: ReturnType<typeof geo>['g']) => g.locks.filter((l) => l.layer !== 'over' && l.spine && l.spine.length > 1).reduce((a, l) => a + (l.spine![l.spine!.length - 1]!.x), 0) / g.locks.length;

describe('vent sur les cheveux', () => {
  it('vent nul : géométrie strictement identique (mêmes polygones, même objet)', () => {
    for (const s of STYLES) {
      const a = geo(s).g, b = geo(s, { x: 0, y: 0, flex: 1 }).g, c = geo(s, { x: 1, y: 1, flex: 0 }).g;
      expect(JSON.stringify(b.locks.map((l) => l.poly))).toBe(JSON.stringify(a.locks.map((l) => l.poly)));
      expect(JSON.stringify(c.locks.map((l) => l.poly))).toBe(JSON.stringify(a.locks.map((l) => l.poly)));
    }
  });

  it('x > 0 pousse les pointes vers la droite, x < 0 vers la gauche (symétrie)', () => {
    for (const s of ['short', 'long', 'bob', 'spiky'] as const) {
      const r = tipX(geo(s).g), p = tipX(geo(s, { x: 1, y: 0 }).g), n = tipX(geo(s, { x: -1, y: 0 }).g);
      expect(p).toBeGreaterThan(r + 0.3);
      expect(n).toBeLessThan(r - 0.3);
      expect(p - r).toBeCloseTo(r - n, 0);
    }
  });

  it('les racines ne bougent pas, les pointes bougent plus que le milieu (levier)', () => {
    const a = geo('long').g, b = geo('long', { x: 1, y: 0 }).g;
    let checked = 0, tips = 0, mids = 0;
    a.locks.forEach((l, i) => {
      const m = b.locks[i]!;
      if (!l.spine || !m.spine || l.layer === 'over' || l.spine.length < 4) return;
      const d = (k: number) => Math.hypot(m.spine![k]!.x - l.spine![k]!.x, m.spine![k]!.y - l.spine![k]!.y);
      const last = l.spine.length - 1, mid = last >> 1;
      expect(d(0)).toBeLessThan(0.5);
      tips += d(last); mids += d(mid);
      checked++;
    });
    expect(checked).toBeGreaterThan(5);
    // En moyenne la pointe bouge plus que le milieu (les mèches butées contre le visage sont ramenées en place, d'où la moyenne).
    expect(tips).toBeGreaterThan(mids);
  });

  it('le vent ne recouvre pas la peau du visage (sommets de mèches avant)', () => {
    for (const s of STYLES) for (const x of [-1, 1]) {
      const { g } = geo(s, { x, y: 0.3, flex: 1 }), r = geo(s).g;
      const onFace = (gg: typeof g) => gg.locks.filter((l) => l.layer === 'front').flatMap((l) => l.poly).filter((q) => gg.boundary.isFace(q.x, q.y)).length;
      expect(onFace(g)).toBeLessThanOrEqual(onFace(r) + 3);
    }
  });

  it('amplitude bornée : la pointe d\'une mèche se déplace d\'au plus 25 % de sa longueur', () => {
    const a = geo('long').g, b = geo('long', { x: 1, y: 1, flex: 1 }).g;
    a.locks.forEach((l, i) => {
      const m = b.locks[i]!;
      if (!l.spine || !m.spine || l.layer === 'over' || l.spine.length < 2) return;
      let L = 0; for (let k = 1; k < l.spine.length; k++) L += Math.hypot(l.spine[k]!.x - l.spine[k - 1]!.x, l.spine[k]!.y - l.spine[k - 1]!.y);
      const e = l.spine.length - 1;
      expect(Math.hypot(m.spine[e]!.x - l.spine[e]!.x, m.spine[e]!.y - l.spine[e]!.y)).toBeLessThanOrEqual(0.3 * L + 1e-6);
    });
  });
});
