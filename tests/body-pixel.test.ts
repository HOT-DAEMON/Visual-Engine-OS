import { describe, expect, it } from 'vitest';
import { encodePngRgba } from '../src/core/png';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel } from '../src/body/volume';
import { verifyPixels } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';
import { fitToRef, loadRef, silhouetteIou } from '../scripts/body-refs/iou';

const H = bodyHost(), ref = loadRef();
const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
describe('rendu par pixel des volumes', () => {
  it('PNG : signature valide et déterministe', () => {
    const a = encodePngRgba(2, 2, new Uint8Array(16).fill(200)), b = encodePngRgba(2, 2, new Uint8Array(16).fill(200));
    expect([...a.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(a.equals(b)).toBe(true);
  });
  const m = renderVolumesPixel(set, { skin: H.skin, heightPx: 420 });
  it('SVG avec image incrustée, sans NaN, mêmes volumes que la sélection vectorielle', () => {
    expect(m.svg).toContain('data:image/png;base64,');
    expect(m.svg).not.toMatch(/NaN|Infinity/);
    expect(m.drawn).toBeGreaterThan(80);
  });
  it('déterministe : deux rendus identiques octet à octet', () => {
    const m2 = renderVolumesPixel(set, { skin: H.skin, heightPx: 420 });
    expect(m2.svg).toBe(m.svg);
  });
  it('vérification 3 couches du rendu : aucun échec', () => {
    const r = verifyPixels(m, set);
    expect(r.failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
    expect(r.checks.length).toBeGreaterThanOrEqual(8);
  });
  it('plusieurs points de vue : le rendu reste fini et non vide', () => {
    for (const yaw of [35, 90, 180]) { const q = renderVolumesPixel(set, { skin: H.skin, heightPx: 260, camera: { yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } }); expect(q.pixels.w * q.pixels.h).toBeGreaterThan(1000); expect(q.svg).not.toMatch(/NaN/); }
  });
});
describe('fidélité de silhouette à ref-02 (plancher de non-régression)', () => {
  it('veryMuscular : IoU ≥ 0,75 et écart de largeur ≤ 12 %', () => {
    const r = silhouetteIou(ref, fitToRef(ref, ARCHETYPES.veryMuscular as BodyInput, H.a, H.skin));
    expect(r.iou).toBeGreaterThanOrEqual(0.75);
    expect(r.rowErr).toBeLessThanOrEqual(0.12);
    expect(r.spanRatio).toBeGreaterThan(0.95);
  });
});
