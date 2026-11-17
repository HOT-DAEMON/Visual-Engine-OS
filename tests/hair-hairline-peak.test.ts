import { describe, expect, it } from 'vitest';
import { faceLandmarks, halfWidthAt } from '../src/face';
import { buildHairline, HAIRLINE_PEAK_TURN } from '../src/face/hair/hairline';
import { FaceParams } from '../src/schema';
import { hairFace } from '../scripts/lib/hair-faces';

/**
 * Rabotage des sommets de la ligne d'implantation (`docs/ROTATION-HAIR-PASS-6.md`) : 15 % des visages (9 graines sur 60) avaient un coin de 0,9 à 1,6 rad
 * au raccord du recul de tempe et de la contrainte « posée sur le crâne ».
 */
const turn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number =>
  Math.abs(Math.atan2((c.y - b.y) * (b.x - a.x) - (c.x - b.x) * (b.y - a.y), (c.x - b.x) * (b.x - a.x) + (c.y - b.y) * (b.y - a.y)));

const build = (seed: number) => {
  const host = hairFace('short', 1, { seed }).objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const p = FaceParams.parse(host.face), lm = faceLandmarks(p, host.width, host.height);
  return { hl: buildHairline(p, lm), lm };
};
const seeds = Array.from({ length: 60 }, (_, i) => 9000 + i);

describe('lisière de face : plus de sommet aigu', () => {
  it('aucun SOMMET (plus haut que ses deux voisins) ne dépasse le seuil de virage, sur 60 graines', () => {
    for (const sd of seeds) {
      const { pts } = build(sd).hl;
      for (let i = 1; i + 1 < pts.length; i++) {
        const a = pts[i - 1]!, b = pts[i]!, c = pts[i + 1]!;
        if (b.y < a.y && b.y < c.y) expect(turn(a, b, c), `graine ${sd}, point ${i}`).toBeLessThanOrEqual(HAIRLINE_PEAK_TURN + 0.02);
      }
    }
  });

  it('le coin de 92° de la graine 9002 (s ≈ 0,69) est arrondi (virage max < 0,9 rad)', () => {
    const { pts } = build(9002).hl;
    let m = 0;
    for (let i = 1; i + 1 < pts.length; i++) m = Math.max(m, turn(pts[i - 1]!, pts[i]!, pts[i + 1]!));
    expect(m).toBeLessThan(0.9);
  });

  it('les extrémités (coins de tempe : elles portent les pattes) et l’abscisse de chaque point ne changent pas', () => {
    for (const sd of [9002, 9007, 9014]) {
      const { hl, lm } = build(sd);
      const N = hl.pts.length - 1;
      const xEnd = (hl.pts[N] as { x: number }).x;
      expect((hl.pts[0] as { x: number }).x).toBeCloseTo(-xEnd, 6);
      hl.pts.forEach((q, i) => expect(q.x).toBeCloseTo((-1 + (2 * i) / N) * xEnd, 6));
      expect(lm.W).toBeGreaterThan(0);
    }
  });

  it('la lisière reste POSÉE SUR LE CRÂNE après rabotage (|x| ≤ 0,985 × demi-largeur du contour)', () => {
    for (const sd of seeds) {
      const { hl, lm } = build(sd);
      for (const q of hl.pts) expect(Math.abs(q.x), `graine ${sd}`).toBeLessThanOrEqual(0.985 * halfWidthAt(lm.outline, q.y) + 1e-6);
    }
  });
});
