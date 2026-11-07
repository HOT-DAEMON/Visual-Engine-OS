import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { buildBoundary } from '../src/face/hair/boundary';
import { REF_SPEC, faceYToU, headSpecFromFace, inRegion, regionField, regionFromBoundary, regionKnots, signedDistance, smoothRegion } from '../src/head-turntable';
import { HAIR_STYLES } from '../src/schema';
import { checkHeadHair } from '../src/verify/head-hair';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald');
const mk = (seed: number, style: string) => generateRandomFace(seed, { hairEngine: 'classic', hair: { style, seed: 4 } as never } as never);
const bnd = (f: ReturnType<typeof mk>) => buildBoundary(f.params, faceLandmarks(f.params, f.width, f.height));

describe('pont lisière → tête en rotation', () => {
  it('la région est un polygone fermé, fini, qui contient le sommet et exclut le visage', () => {
    for (const s of STYLES) {
      const f = mk(21, s), b = bnd(f), R = regionFromBoundary(b);
      expect(R.every(([a, y]) => Number.isFinite(a) && Number.isFinite(y))).toBe(true);
      expect(inRegion(R, 0, 0.03)).toBe(true);
      expect(inRegion(R, 0, 0.6)).toBe(false);
      expect(inRegion(R, 180, 0.3)).toBe(true);
      expect(inRegion(R, -180, 0.3)).toBe(true);
    }
  });

  it('la poche de peau entre implantation et patte est HORS région (lisière à deux valeurs)', () => {
    const f = mk(22, 'short'), b = bnd(f), R = smoothRegion(regionFromBoundary(b)), F = regionField(R);
    const tip = b.loop.filter((q) => q.kind === 'sideburn');
    expect(tip.length).toBeGreaterThan(2);
    const knots = regionKnots(R);
    expect(knots[0]![1]).toBeCloseTo(faceYToU(b, b.hairline.pts[Math.floor(b.hairline.pts.length / 2)]!.y), 1);
    expect(signedDistance(F, 0, 0.5)).toBeLessThan(0);
    expect(signedDistance(F, 0, 0.05)).toBeGreaterThan(0);
  });

  it('symétrie gauche/droite de la région (face symétrique)', () => {
    const f = mk(23, 'bob'), R = regionFromBoundary(bnd(f)), F = regionField(smoothRegion(R));
    for (const y of [0.1, 0.3, 0.5, 0.7]) for (const az of [20, 60, 100, 150]) expect(signedDistance(F, az, y) * signedDistance(F, -az, y)).toBeGreaterThanOrEqual(0);
  });

  it('headSpecFromFace : lisière du visage, couleurs du visage, reste de la spec inchangé', () => {
    const f = mk(24, 'long'), spec = headSpecFromFace(f.params, bnd(f), '#c8a58a');
    expect(spec.hairline.region).toBeDefined();
    expect(spec.palette.hair).toBe(f.params.hair.color);
    expect(spec.palette.skin).toBe('#c8a58a');
    expect(spec.rows).toBe(REF_SPEC.rows);
  });

  it.each(STYLES)('%s : contrôles de vérification de la tête tournante sans erreur', (s) => {
    for (let k = 0; k < 3; k++) expect(checkHeadHair(mk(60 + k * 13, s)).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id)).toEqual([]);
  });

  it('contrôle négatif : une région qui mange l\'œil est détectée', async () => {
    const { regionField: rf } = await import('../src/head-turntable');
    const f = mk(25, 'short'), b = bnd(f);
    const R = regionFromBoundary(b).map(([a, y]) => [a, y > 0 && Math.abs(a) < 100 ? y + 0.5 : y] as [number, number]);
    expect(signedDistance(rf(R), 0, faceYToU(b, faceLandmarks(f.params, f.width, f.height).eyeY))).toBeGreaterThan(0);
  });
});
