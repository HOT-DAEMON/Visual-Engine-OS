import { describe, expect, it } from 'vitest';
import { project } from '../src/hair-grammar/head';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import type { PartObservation } from '../src/hair-grammar/observe-part';
import { imageUToSkull, partFromObservation, PART_INVERT_TOL, skullFromImageU } from '../src/hair-grammar/reference-fit-part';
import { rad } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const P = TOUSLED; const h = P.head;
const obs = (u: number): PartObservation => ({ u, clarity: 0.9, width: 0.1, window: 0, groove: true } as PartObservation);
/** Erreur de re-projection (rx) de la position de crâne `xp` par rapport à la cible image `u`, recalculée INDÉPENDAMMENT de `skullFromImageU`. */
function reproj(yaw: number, xp: number, u: number): number {
  const V = viewAt(yaw); const c = Math.cos(rad(47)); const s = Math.sin(rad(47)); const az = Math.asin(Math.max(-1, Math.min(1, xp / (h.rx * c))));
  const p = { x: h.rx * c * Math.sin(az), y: -h.ry * s, z: h.cz + h.rz * c * Math.cos(az) }; const cx = project(V, { x: 0, y: 0, z: h.cz }).x;
  return Math.abs(project(V, p).x - (cx + u * h.rx * V.s)) / (h.rx * V.s);
}

describe('raie lue sur un côté détourné ou hors plage (passe 7)', () => {
  it('point atteignable : erreur ≤ tolérance, raie retenue, et l\'erreur annoncée est l\'erreur réelle', () => {
    for (const [yaw, u] of [[0, -0.6], [0, 0], [0, 0.6], [30, -0.3], [30, 0.6], [60, 0.3], [75, 0.3]] as const) {
      const r = skullFromImageU(P, viewAt(yaw), u)!; expect(r.err, `yaw ${yaw} u ${u}`).toBeLessThanOrEqual(PART_INVERT_TOL);
      expect(Math.abs(reproj(yaw, r.xp, u) - r.err)).toBeLessThan(1e-6);
      expect(partFromObservation(obs(u), P, viewAt(yaw))).toBeCloseTo(r.xp, 9);
    }
  });
  it('côté détourné (lacet 60–75°) ou hors plage (|u| 0,9) : aucune raie inventée', () => {
    for (const [yaw, u] of [[0, -0.9], [0, 0.9], [30, -0.9], [60, -0.6], [60, -0.9], [75, -0.6], [75, -0.3]] as const) {
      const r = skullFromImageU(P, viewAt(yaw), u)!; expect(r.err, `yaw ${yaw} u ${u}`).toBeGreaterThan(PART_INVERT_TOL);
      expect(partFromObservation(obs(u), P, viewAt(yaw)), `yaw ${yaw} u ${u}`).toBeUndefined();
    }
  });
  it('avant : la position retournée par imageUToSkull sur ces cas était à plus de 0,15 rx de la cible, acceptée sans signal', () => {
    for (const [yaw, u] of [[60, -0.9], [75, -0.6], [75, -0.3]] as const) expect(reproj(yaw, imageUToSkull(P, viewAt(yaw), u), u)).toBeGreaterThan(0.15);
  });
  it('imageUToSkull garde son comportement historique (même position que skullFromImageU)', () => {
    for (const [yaw, u] of [[0, 0.3], [30, -0.9], [75, -0.3]] as const) expect(imageUToSkull(P, viewAt(yaw), u)).toBe(skullFromImageU(P, viewAt(yaw), u)!.xp);
  });
  it('sillon incertain : toujours rejeté avant même l\'inversion', () => {
    expect(partFromObservation({ ...obs(0), clarity: 0.3 }, P, viewAt(0))).toBeUndefined();
    expect(partFromObservation({ ...obs(0), groove: false }, P, viewAt(0))).toBeUndefined();
  });
});
