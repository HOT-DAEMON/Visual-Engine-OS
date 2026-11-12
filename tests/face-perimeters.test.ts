import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { browGapPerEye, eyeBands, facePerimeters, faceLandmarks, fitEyeToFace, BROW_GAP, PERIMETER_LIMITS } from '../src/face';
import type { EyeInput } from '../src/face';
import { checkPerimeters } from '../src/verify/perimeters';

type Face = ReturnType<typeof generateRandomFace>;
const lmOf = (f: Face) => faceLandmarks(f.params, f.width, f.height);
const bandsOf = (f: Face) => (['left', 'right'] as const).map((s) => eyeBands(s, f.fits[s], lmOf(f)));

describe('périmètres d\'occupation des composants enfants', () => {
  it('les neuf périmètres forment une chaîne verticale ordonnée et contiguë, dans leurs bornes (40 visages structured)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const f = generateRandomFace(seed, { structure: true }), P = facePerimeters(f.params, lmOf(f), bandsOf(f));
      expect(P.list.map((q) => q.id)).toEqual(['forehead', 'brows', 'browGap', 'eyes', 'interocular', 'nose', 'philtrum', 'mouth', 'chin']);
      expect(checkPerimeters(f as never).filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
      expect(P.byId.nose.topY).toBeGreaterThanOrEqual(P.byId.interocular.bottomY - 1e-6);   // le nez commence SOUS la zone entre les yeux
      expect(P.byId.philtrum.topY).toBeCloseTo(P.byId.nose.bottomY, 9);
      expect(P.byId.chin.bottomY).toBeCloseTo(lmOf(f).chinY, 9);
      for (const q of P.list) expect(q.heightPx).toBeGreaterThan(0);
    }
    expect(PERIMETER_LIMITS.browGap.height).toEqual(BROW_GAP);
  });

  it('moteur classic : aucun contrôle de périmètre (comportement inchangé)', () => {
    expect(checkPerimeters(generateRandomFace(7) as never)).toEqual([]);
  });

  it('l\'écart sourcil / paupière est borné ŒIL PAR ŒIL sur 120 visages, et reste flexible (plage réellement parcourue)', () => {
    const gaps: number[] = [];
    for (let seed = 1; seed <= 120; seed++) {
      const f = generateRandomFace(seed, { structure: true }), H = lmOf(f).H;
      for (const g of browGapPerEye(bandsOf(f))) { expect(g / H).toBeGreaterThanOrEqual(BROW_GAP.min - 0.0015); expect(g / H).toBeLessThanOrEqual(BROW_GAP.max + 0.0015); gaps.push(g / H); }
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.03);   // flexible : pas une valeur unique
  });

  it('fitEyeToFace { perimeters } ramène un sourcil qui chevauche ou flotte dans la plage ; sans l\'option, il n\'y est pas (le contrôle n\'est pas aveugle)', () => {
    const f = generateRandomFace(5, { structure: true }), lm = lmOf(f), H = lm.H, base = f.fits.left.eye as EyeInput;
    const withGap = (gap: number): EyeInput => ({ ...base, eyebrow: { ...(base as { eyebrow: object }).eyebrow, gap } }) as EyeInput;
    const gapOf = (e: EyeInput, perimeters: boolean): number => browGapPerEye([eyeBands('left', fitEyeToFace(e, 'left', lm, { perimeters }), lm)])[0]! / H;
    expect(gapOf(withGap(0), false)).toBeLessThan(BROW_GAP.min);            // sourcil collé à la paupière
    expect(gapOf(withGap(1), false)).toBeGreaterThan(BROW_GAP.max);          // sourcil flottant
    expect(gapOf(withGap(0), true)).toBeGreaterThanOrEqual(BROW_GAP.min - 0.0015);
    expect(gapOf(withGap(1), true)).toBeLessThanOrEqual(BROW_GAP.max + 0.0015);
  });

  it('la vérification ÉCHOUE sur un sourcil qui chevauche la paupière (défaut injecté)', () => {
    const f = generateRandomFace(5, { structure: true }), lm = lmOf(f), base = f.fits.left.eye as EyeInput;
    const bad = { ...base, eyebrow: { ...(base as { eyebrow: object }).eyebrow, gap: 0 } } as EyeInput;
    const face = { ...f, fits: { ...f.fits, left: fitEyeToFace(bad, 'left', lm) } };
    expect(checkPerimeters(face as never).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id)).toContain('brow-gap-min-0');
  });

  it('sans l\'option (absente ou false), l\'ajustement des yeux est strictement le même', () => {
    const f = generateRandomFace(9), lm = lmOf(f), e = f.fits.left.eye as EyeInput;
    const a = fitEyeToFace(e, 'left', lm), b = fitEyeToFace(e, 'left', lm, { perimeters: false });
    expect(b).toEqual(a);
  });
});
