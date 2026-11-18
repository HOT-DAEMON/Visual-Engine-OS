import { describe, expect, it } from 'vitest';
import { faceLandmarks } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { FLANK_FADE, HAIRLINE_FADE } from '../src/face/hair/comb';
import { distanceOutsideSkull, maxShell } from '../src/face/hair/thickness';
import { FaceParams } from '../src/schema';
import { hairFace, type CleanStyle } from '../scripts/lib/hair-faces';

/** Coupe rase : la coque descend sur les flancs (plus de calotte) et reste au crâne (`docs/ROTATION-HAIR-BUZZ.md`). */
const geo = (style: CleanStyle, seed: number) => {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height);
  return { lm, g: hairGeometry(params, lm)! };
};

describe('rasé : flancs', () => {
  it('la coque descend sous le coin de tempe (≥ 0,1 H) sur les 6 graines : plus de calotte arrêtée à la tempe', () => {
    for (const seed of [9000, 9001, 9002, 9003, 9004, 9005]) {
      const { lm, g } = geo('buzz', seed), ys = g.base[0]!.map((q) => q.y), corner = Math.max(g.boundary.marks.cornerY.left, g.boundary.marks.cornerY.right);
      expect(Math.max(...ys)).toBeGreaterThan(corner + 0.1 * lm.H);
    }
  });
  it('la coque reste au crâne : distance au contour ≤ épaisseur maximale + 0,5 px au-dessus de l\'arche de l\'oreille', () => {
    for (const seed of [9000, 9001, 9002, 9003, 9004, 9005]) {
      const { lm, g } = geo('buzz', seed), S = g.boundary.skull, archY = Math.min(g.boundary.marks.earTopY.left, g.boundary.marks.earTopY.right) - 0.03 * lm.H;
      const d = Math.max(...g.base[0]!.filter((q) => q.y < archY).map((q) => distanceOutsideSkull(S, q)));
      expect(d).toBeLessThanOrEqual(maxShell('buzz', lm.W) + 0.5);
    }
  });
  it('fondus : constantes plausibles (opacité ∈ ]0, 1], largeur de fondu d\'implantation < 0,1 H)', () => {
    expect(FLANK_FADE.alpha).toBeGreaterThan(0);
    expect(FLANK_FADE.alpha).toBeLessThanOrEqual(1);
    expect(HAIRLINE_FADE.width).toBeLessThan(0.1);
  });
});
