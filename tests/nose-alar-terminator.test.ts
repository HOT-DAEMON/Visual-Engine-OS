/**
 * Continuité du terminateur sur l'aile PROCHE (docs/NOSE-ALAR-SPOT-2.md). À 60° (pyramide), l'aile proche était éclairée sur 2–25 % de ses pixels alors que la joue autour est à l'ombre (0 %) :
 * ovale clair à bord net. Cause : 15 % de la normale de l'ellipsoïde survivent à l'adoucissement et franchissent le seuil du cel. Correctif : `terminatorClamp` (nose-light.ts).
 */
import { describe, expect, it } from 'vitest';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from '../scripts/nose-refs/alar-overflow';
import { gbufOf } from '../scripts/nose-refs/alar-spot-measure';
import { reliefLight } from '../src/head-turntable/paint';
import { alaWeigher, terminatorClamp, TERMINATOR_MARGIN, wingLighter, wingTerminatorGap } from '../src/head-turntable/nose-light';
import { noseLightStyle } from '../src/head-turntable/verify-engines';
import { alaOf } from '../src/head-turntable/parts';
import { dot, norm, v3 } from '../src/head-turntable/math';
import { withRig } from '../src/head-turntable/roll';
import { PART } from '../src/head-turntable/mesh';
import { shadeAt } from '../src/relief/model';
import { lightModelOfSpec, patternById } from '../src/relief';

const q = patternById('three-quarter-right'), model = lightModelOfSpec({} as never, { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } } as never);
const subject = (seed: number, a?: string) => head3dSubject(hostOf(seed, a), {} as never).spec;

describe('terminatorClamp (pur)', () => {
  const dir = model.dir;
  it('ramène n·l dans [face − marge, face + marge] (w = 1), laisse la normale intacte si elle y est déjà ou si w = 0, reste unitaire', () => {
    let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
    for (let i = 0; i < 400; i++) {
      const n = norm(v3(rnd(), rnd(), Math.abs(rnd()) + 0.1)), f = norm(v3(rnd(), rnd(), Math.abs(rnd()) + 0.1)), o = terminatorClamp(n, f, 1, dir);
      expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(1, 6);
      expect(Math.abs(dot(o, dir) - dot(f, dir))).toBeLessThanOrEqual(Math.max(TERMINATOR_MARGIN, Math.abs(dot(n, dir) - dot(f, dir))) + 1e-5);
      if (Math.abs(dot(n, dir) - dot(f, dir)) <= TERMINATOR_MARGIN) expect(o).toEqual(n);
      expect(terminatorClamp(n, f, 0, dir)).toEqual(n);
    }
  });
});

describe('règle eng.nose.alar-terminator (géométrie de l\'aile × lumière trois-quarts)', () => {
  it('0 avec la continuité (4 types de nez × 6 graines × lacets 30–70°), et la règle DÉTECTE l\'ancien état (sans continuité > 0,1 à 45° ou 60°)', () => {
    let worstWith = 0, worstWithout = 0;
    for (const a of ['pyramide', 'cloche-ailes', 'plat-trapeze', undefined]) for (let k = 0; k < 6; k++) {
      const spec = subject(11 + k * 37, a), c = noseLightStyle(spec).find((x) => x.id === 'eng.nose.alar-terminator')!;
      expect(c.ok, `${a} graine ${11 + k * 37}`).toBe(true);
      for (const yaw of [30, 45, 60, 70]) { const view = withRig({ yaw, pitch: 0 }, spec); worstWith = Math.max(worstWith, wingTerminatorGap(spec, view, model, true)); if (yaw === 45 || yaw === 60) worstWithout = Math.max(worstWithout, wingTerminatorGap(spec, view, model, false)); }
    }
    expect(worstWith).toBe(0); expect(worstWithout).toBeGreaterThan(0.1);
  }, 120000);
});

describe('rendu à 60° : plus d\'ovale clair sur la joue à l\'ombre', () => {
  it('part éclairée de l\'aile proche (pixels) ≤ 2 % — avant le correctif : 25 % (graine 11), 2 % (1203), 7 % (48) ; la joue autour : 0 %', () => {
    for (const seed of [11, 1203, 48]) {
      const { spec, view, g, ppuHi } = gbufOf(subject(seed, 'pyramide'), 60), rl = reliefLight(spec, g, { lineU: 0.022, ppuHi, light: model, shadowTint: null }, model, view), weigh = alaWeigher(spec), wl = wingLighter(spec, view, model);
      const cnt = [0, 0], side = new Int8Array(g.w * g.h).fill(-1);
      for (let k = 0; k < g.w * g.h; k++) if (g.id[k] === PART.bump) { const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!); if (weigh(p) < 0.999) continue; const s = p.x >= 0 ? 0 : 1, a = alaOf(spec, s === 0 ? 1 : -1); if (Math.hypot((p.x - a.c.x) / a.ex, (p.y - a.c.y) / a.ey, (p.z - a.c.z) / a.ez) > 1.4) continue; side[k] = s; cnt[s]!++; }
      const near = cnt[0]! >= cnt[1]! ? 0 : 1; let n = 0, lit = 0;
      for (let k = 0; k < g.w * g.h; k++) if (side[k] === near) { const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!); n++; lit += shadeAt(model, wl(p, norm(v3(g.N[3 * k]!, g.N[3 * k + 1]!, g.N[3 * k + 2]!))), rl.cast[k]!, rl.ao[k]!).lit; }
      expect(n).toBeGreaterThan(300); expect(lit / n, `graine ${seed}`).toBeLessThanOrEqual(0.02);
    }
  }, 120000);
});
