import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, type HairGeometry } from '../src/face';
import { bunMetrics, checkHairNatural, NATURAL_LIMITS, outlineDent } from '../src/verify/hair-natural';
import { verifyFace } from '../src/verify';
import { hairFaceSpec, type CleanStyle } from '../scripts/lib/hair-faces';

const make = (st: CleanStyle, k: number) => {
  const sp = hairFaceSpec(st, k + 1, { engine: 'v2', seed: 9000 + k * 71, identity: k % 8 });
  const f = generateRandomFace(sp.seed, sp.opts), lm = faceLandmarks(f.params, f.width, f.height);
  return { f, lm, g: hairGeometry(f.params, lm) as HairGeometry };
};

describe('hair-natural (docs/HAIR-NATURAL.md)', () => {
  it('positif : afro / bouclé / chignon, 12 visages chacun, aucun contrôle en échec ni en avertissement', () => {
    for (const st of ['afro', 'curly', 'bun'] as CleanStyle[]) for (let k = 0; k < 12; k++) {
      const { f } = make(st, k);
      expect(checkHairNatural(f).filter((c) => !c.ok).map((c) => `${st}${k}:${c.id}=${c.value.toFixed(3)}`)).toEqual([]);
    }
  });

  it('la couche est branchée dans verifyFace', () => {
    const { f } = make('bun', 2);
    expect(verifyFace(f).checks.some((c) => c.id === 'bun-radius-min')).toBe(true);
  });

  it('négatif : un cran dans le contour est détecté', () => {
    const { f, lm, g } = make('afro', 3);
    const base = g.base[0]!;
    expect(outlineDent(base, lm.W)).toBeLessThan(NATURAL_LIMITS.dent);
    // Creuse une encoche sur le flanc droit, à mi-hauteur du dôme : la largeur recule puis revient.
    const ys = base.map((v) => v.y), mid = Math.min(...ys) + 0.35 * (Math.max(...ys) - Math.min(...ys));
    const dented = base.map((v) => (v.x > 0 && Math.abs(v.y - mid) < 0.05 * lm.H ? { x: v.x - 0.12 * lm.W, y: v.y } : v));
    const bad = { ...g, base: [dented, ...g.base.slice(1)] } as HairGeometry;
    expect(checkHairNatural(f, bad).find((c) => c.id === 'natural-outline-dent')!.ok).toBe(false);
  });

  it('négatif : un chignon minuscule ou caché est refusé', () => {
    const { f, lm, g } = make('bun', 4);
    const m = bunMetrics(g, lm)!;
    expect(m.radius).toBeGreaterThan(NATURAL_LIMITS.bunRadiusMin);
    const shrink = (k: number) => ({ ...g, locks: g.locks.map((l) => (l.part === 'bun' ? { ...l, poly: l.poly.map((q) => ({ x: q.x * k, y: q.y * k })) } : l)) }) as HairGeometry;
    expect(checkHairNatural(f, shrink(0.3)).find((c) => c.id === 'bun-radius-min')!.ok).toBe(false);
    expect(checkHairNatural(f, shrink(3)).find((c) => c.id === 'bun-radius-max')!.ok).toBe(false);
    // Le chignon ramené au centre du crâne est caché : `bun-visible` échoue.
    const hidden = { ...g, locks: g.locks.map((l) => (l.part === 'bun' ? { ...l, poly: l.poly.map((q) => ({ x: q.x * 0.05, y: g.boundary.skull.topY + 0.3 * lm.H + (q.y - g.boundary.skull.topY) * 0.05 })) } : l)) } as HairGeometry;
    expect(checkHairNatural(f, hidden).find((c) => c.id === 'bun-visible')!.ok).toBe(false);
  });
});
