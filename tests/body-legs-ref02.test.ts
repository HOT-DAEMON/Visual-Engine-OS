import { describe, expect, it } from 'vitest';
import { ARCHETYPES, LEGS_REF02, type BodyInput } from '../src/body';
import { bodyHost } from '../scripts/lib/body-host';
import { fitToRef, loadRef } from '../scripts/body-refs/iou';
import { legsIou } from '../scripts/body-refs/legs-iou';
import { bodyVolumes } from '../src/body/volume';
import { verifyLegs3D } from '../src/verify';

const H = bodyHost(), ref = loadRef('ref-02'), raw = ARCHETYPES.veryMuscular as BodyInput;
describe('jambes 3D contre ref-02 (silhouette)', () => {
  it('valeurs par défaut : IoU des jambes mesuré (≈ 0,44) — plancher de non-régression', () => {
    const r = legsIou(ref, fitToRef(ref, raw, H.a, H.skin));
    expect(r.iou).toBeGreaterThan(0.4);
  });
  it('préréglage LEGS_REF02 : IoU des jambes ≥ 0,75, sol et genoux à ± 3 % de la référence', () => {
    const r = legsIou(ref, fitToRef(ref, raw, H.a, H.skin, undefined, { legs: LEGS_REF02 }));
    expect(r.iou).toBeGreaterThanOrEqual(0.75);
    expect(Math.abs(r.bottomMot - r.bottomRef) / r.bottomRef).toBeLessThan(0.03);
    expect(Math.abs(r.kneeWMot - r.kneeWRef) / r.kneeWRef).toBeLessThan(0.05);
  });
  it('le préréglage passe la vérification 3 couches des jambes', () => {
    const set = bodyVolumes(raw, H.a, { legs: LEGS_REF02 });
    expect(verifyLegs3D(set, raw, H.a, LEGS_REF02).failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
  });
});
