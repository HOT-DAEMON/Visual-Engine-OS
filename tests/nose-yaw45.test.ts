import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf, noseOverflow } from '../scripts/nose-refs/alar-overflow';
import { bumps } from '../scripts/nose-refs/yaw45-engine';
import { alaOf, alaPull, alaSeated } from '../src/head-turntable/parts';
import { ALA_CONTOUR_BOUNDS, ALA_TOL_45, alaOverflow } from '../src/head-turntable/nose-contour';
import { engineGeometry } from '../src/head-turntable/verify-engines';
import { REF_SPEC } from '../src/head-turntable/spec';
import type { HeadTurnSpec } from '../src/head-turntable';

/** Borne du 45° mesurée contre la planche de rotation (docs/NOSE-YAW45.md). */
const subject = (seed: number, a?: string): HeadTurnSpec => head3dSubject(hostOf(seed, a), {} as never).spec;
const wide = (s: HeadTurnSpec, k: number): HeadTurnSpec => ({ ...s, nose: { ...s.nose, alaX: s.nose.alaX * k } }) as HeadTurnSpec;
const ref = JSON.parse(readFileSync('references/nez/measures-45deg-protrusion.json', 'utf8')) as { views: Record<string, { min: number; median: number; max: number }> };

describe('nez à 45° : borne mesurée contre la planche de rotation', () => {
  it('la planche : le nez de REF_SPEC ne dépasse pas le contour jusqu\'à 45° (rendu et calcul), il le dépasse à 60° : la borne s\'arrête donc à 45°', () => {
    for (const y of [20, 30, 45]) { expect(noseOverflow(REF_SPEC, y, 300).far, `${y}°`).toBeLessThan(ALA_TOL_45); expect(alaOverflow(REF_SPEC, alaOf(REF_SPEC, -1), y)).toBeLessThan(ALA_TOL_45); }
    expect(noseOverflow(REF_SPEC, 60, 300).far).toBeGreaterThan(0.015);
    expect(ALA_CONTOUR_BOUNDS.map((b) => b.yaw)).toEqual([30, 45]);
  });

  it('parité d\'estimateur : la saillie à la corde de REF_SPEC rendu sous le tangage de la planche tombe dans la bande MESURÉE sur les pixels (±0,01 U) à 45° et à 70°', () => {
    for (const y of [45, 70]) {
      const c = [...bumps(REF_SPEC, y).chord].sort((a, b) => a - b), med = c[4]!, band = ref.views[String(y)]!;
      expect(med, `${y}°`).toBeGreaterThanOrEqual(band.min - 0.01); expect(med, `${y}°`).toBeLessThanOrEqual(band.max + 0.01);
    }
  });

  it('contrainte : un nez élargi déborde sans rappel (> 0,03 U à 45°) ; avec le rappel plafonné il déborde moins, et le 30° reste exact', () => {
    const s = wide(subject(77, 'plat-trapeze'), 1.3), before = alaOverflow(s, alaSeated(s, -1, 0), 45), after = alaOverflow(s, alaOf(s, -1), 45);
    expect(before).toBeGreaterThan(0.03); expect(after).toBeLessThan(before - 0.01);
    expect(alaOverflow(s, alaOf(s, -1), 30)).toBeLessThan(1e-4);
  });

  it('le plafond du 45° tient : sans exigence du 30°, le rappel reste ≤ 0,25 × alaX (nez libres et pyramides, 8 graines)', () => {
    for (const a of [undefined, 'pyramide'] as const) for (const seed of [11, 77, 1203, 537]) { const s = subject(seed, a); if (alaOverflow(s, alaSeated(s, -1, 0), 30) < 1e-5) expect(alaPull(s)).toBeLessThanOrEqual(0.25 * s.nose.alaX + 1e-6); }
  });

  it('la règle `eng.nose.alar-contour-45` mesure le résiduel et le signale sur un nez trop large (info, jamais bloquante)', () => {
    const rule = (s: HeadTurnSpec) => engineGeometry(s).find((c) => c.id === 'eng.nose.alar-contour-45')!;
    expect(rule(REF_SPEC).ok).toBe(true);
    const w = wide(subject(77, 'plat-trapeze'), 1.3);
    expect(rule(w).ok).toBe(false); expect(rule(w).kind).toBe('info');
  });

  it('déterminisme', () => { const s = subject(11, 'plat-trapeze'); expect(alaPull(s)).toBe(alaPull(s)); });
});
