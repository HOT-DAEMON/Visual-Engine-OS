import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { checkHairEdge, lowerFlare, silhouetteProfile, toothCount } from '../src/verify';

const seeds = Array.from({ length: 30 }, (_, i) => 9000 + i * 71);
const face = (style: string, seed: number) => generateRandomFace(seed, { hair: { style } as never, hairEngine: 'v2' });
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1] as number;

describe('lisière extérieure et retombée (docs/HAIR-EDGE.md)', () => {
  it.each(['afro', 'curly', 'long', 'bob', 'short'])('%s : aucun contrôle d\'erreur de lisière n\'échoue', (style) => {
    for (const sd of seeds) expect(checkHairEdge(face(style, sd)).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id), `${style} ${sd}`).toEqual([]);
  });

  it('afro et bouclé : la silhouette est un volume lisse (médiane de dents ≤ 8 ; mesuré 13 → 4 et 12 → 5)', () => {
    for (const style of ['afro', 'curly']) {
      const t = seeds.map((sd) => { const f = face(style, sd); const lm = faceLandmarks(f.params, f.width, f.height); const g = hairGeometry(f.params, lm)!; return toothCount(silhouetteProfile(g, lm.W, lm.hair.sideY, lm.browLimitY), lm.W); });
      expect(med(t), style).toBeLessThanOrEqual(8);
    }
  });

  it('une mèche qui dépasse la coque du volume est détectée (contrôle négatif : géométrie sabotée)', () => {
    const f = face('afro', seeds[0] as number);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const g = hairGeometry(f.params, lm)!;
    const locks = g.locks.map((l, i) => (i === g.locks.findIndex((m) => m.layer === 'front' && m.kind !== 'wisp' && m.kind !== 'cheek') ? { ...l, poly: l.poly.map((q) => ({ x: q.x, y: q.y - 0.4 * lm.H })) } : l));
    expect(checkHairEdge(f, { ...g, locks }).find((c) => c.id === 'edge-rim-bound')?.ok).toBe(false);
  });

  it('long et bob : le bas de la chevelure ne dépasse pas la largeur de la mâchoire (convergence vers le cou)', () => {
    for (const style of ['long', 'bob']) {
      const r = seeds.map((sd) => { const f = face(style, sd); const lm = faceLandmarks(f.params, f.width, f.height); return lowerFlare(hairGeometry(f.params, lm)!, lm.jawY, lm.H); });
      // Mesuré (60 visages) : long 0,96 → 0,795 ; bob 0,937 → 0,871.
      expect(med(r), style).toBeLessThan(style === 'long' ? 0.88 : 0.92);
      expect(Math.max(...r), style).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
