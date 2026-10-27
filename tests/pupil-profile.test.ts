import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene } from '../src';
import { IRIS_FIT, effectivePupilSize, isLegacyPupil, pupilContours, pupilResponseFactor, unitProfile } from '../src/geometry/eye';
import { PUPIL_SHAPES } from '../src/schema/eye-pupil-profile';

const eyeWith = (pupil: object, extra: object = {}) => EyeSpec.parse({ kind: 'eye', id: 'e', ...extra, pupil });
const svgOf = (pupil: object) => {
  const r = compileScene({ width: 640, height: 520, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', transform: { x: 320, y: 260 }, shape: { width: 400, height: 240 }, pupil }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};

describe('EYE-05 — profils de pupille', () => {
  it('la pupille par défaut reste sur le chemin historique', () => {
    expect(isLegacyPupil(eyeWith({}).pupil)).toBe(true);
    expect(isLegacyPupil(eyeWith({ shape: 'slit_vertical' }).pupil)).toBe(true);
    expect(isLegacyPupil(eyeWith({ shape: 'star' }).pupil)).toBe(false);
    expect(isLegacyPupil(eyeWith({ orientationDeg: 10 }).pupil)).toBe(false);
  });

  it('chaque forme × déformation : contours finis et DANS l’iris (invariant IRIS_FIT)', () => {
    for (const shape of PUPIL_SHAPES)
      for (const size of [0.12, 0.36, 0.7])
        for (const extra of [{}, { orientationDeg: 73, center: { x: 0.3, y: -0.3 }, deform: { squash: 0.4, skew: -0.4, irregularity: 1 } }, { multiple: { count: 5, layout: 'ring', spread: 0.8, scale: 1 } }]) {
          const p = eyeWith({ shape, size, ...extra }).pupil;
          const { contours } = pupilContours(p, size, 50, 56, 7);
          for (const c of contours) for (const v of c) {
            expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
            expect(Math.hypot(v.x / 50, v.y / 56)).toBeLessThanOrEqual(IRIS_FIT + 1e-9);
          }
        }
  });

  it('étoile à n pointes = 2n sommets ; polygone à n côtés = n sommets ; losange = 4', () => {
    expect(unitProfile(eyeWith({ shape: 'star', lobes: { count: 6 } }).pupil)).toHaveLength(12);
    expect(unitProfile(eyeWith({ shape: 'polygon', lobes: { count: 7 } }).pupil)).toHaveLength(7);
    expect(unitProfile(eyeWith({ shape: 'diamond' }).pupil)).toHaveLength(4);
  });

  it('réponse lumineuse : neutre à 0,5, strictement décroissante, bornée', () => {
    for (const m of ['circular', 'vertical_slit', 'horizontal_slit'] as const) {
      expect(pupilResponseFactor(m, 0.5)).toBeCloseTo(1, 12);
      let prev = Infinity;
      for (let l = 0; l <= 1.0001; l += 0.1) { const f = pupilResponseFactor(m, l); expect(f).toBeLessThan(prev); prev = f; }
    }
    expect(pupilResponseFactor('fixed', 0)).toBe(1);
    expect(effectivePupilSize(eyeWith({ size: 0.36, response: { model: 'circular', light: 0 } }).pupil)).toBeGreaterThan(0.36);
    expect(effectivePupilSize(eyeWith({ size: 0.7, response: { model: 'circular', light: 0 } }).pupil)).toBeLessThanOrEqual(0.7);
  });

  it('déterminisme : même graine = mêmes contours ; graine différente = irrégularité différente', () => {
    const p = eyeWith({ shape: 'star', deform: { irregularity: 0.8 } }).pupil;
    const a = pupilContours(p, 0.36, 50, 56, 3).contours;
    expect(pupilContours(p, 0.36, 50, 56, 3).contours).toEqual(a);
    expect(pupilContours(p, 0.36, 50, 56, 4).contours).not.toEqual(a);
  });

  it('rendu : étoile, pupilles multiples, bord doux et teinté produisent un SVG valide', () => {
    const star = svgOf({ shape: 'star', lobes: { count: 5 } });
    expect(star).toContain('<path');
    const multi = svgOf({ shape: 'round', multiple: { count: 3 } });
    expect(multi).not.toBe(svgOf({}));
    expect(pupilContours(eyeWith({ multiple: { count: 3 } }).pupil, 0.36, 50, 56, 1).contours).toHaveLength(3);
    const soft = svgOf({ shape: 'diamond', edge: { softness: 0.6, tint: '#ff8800' } });
    expect(soft).toContain('pupil-soft');
  });

  it('la réponse lumineuse modifie réellement le rendu (dilatation ≠ contraction)', () => {
    const dark = svgOf({ response: { model: 'circular', light: 0 } });
    const bright = svgOf({ response: { model: 'circular', light: 1 } });
    const neutral = svgOf({});
    expect(dark).not.toBe(bright);
    expect(svgOf({ response: { model: 'circular', light: 0.5 } })).toBe(neutral);
  });
});
