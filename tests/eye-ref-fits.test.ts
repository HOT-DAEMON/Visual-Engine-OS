import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REF_FITS } from '../src/generation/eye-ref-fits';
import { extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';

const SIL = JSON.parse(readFileSync('references/eyes/measures-silhouettes.json', 'utf8')).eyes as Record<string, { upperProfile: number[]; lowerProfile: number[]; tiltDeg: number }>;
const target = (f: (typeof REF_FITS)[number]): { upper: number[]; lower: number[]; tilt: number } => {
  const ids = f.source.split('+'); const ms = ids.map((i) => SIL[i]!);
  const avg = (k: 'upperProfile' | 'lowerProfile'): number[] => ms[0]![k].map((_, i) => ms.reduce((s, m) => s + m[k][i]!, 0) / ms.length);
  return { upper: avg('upperProfile'), lower: avg('lowerProfile'), tilt: ms.reduce((s, m) => s + m.tiltDeg, 0) / ms.length };
};

describe('silhouettes mesurées (réfs 13, 15, 17) -> recettes d’enveloppe du moteur existant', () => {
  it('9 silhouettes ajustées, chacune reproduit son profil mesuré (RMS ≤ 0,08 en largeur d’ouverture), recalculé ici depuis le JSON', () => {
    expect(REF_FITS).toHaveLength(9);
    for (const f of REF_FITS) {
      const t = target(f);
      const p = openingProfile(openingGeometry(Shape.parse({ width: 240, height: 240 * f.aspect, tiltDeg: f.tiltDeg, upperFraction: f.upperFraction, openness: f.openness, style: f.style }), Canthi.parse({ inner: { roundness: f.innerRoundness, caruncle: 0.5 }, outer: { roundness: f.outerRoundness } })));
      let s = 0; for (let i = 0; i < 21; i++) s += (p.upper[i]! - t.upper[i]!) ** 2 + (p.lower[i]! - t.lower[i]!) ** 2;
      const rms = Math.sqrt(s / 42); expect(rms).toBeLessThanOrEqual(0.08); expect(rms).toBeCloseTo(f.rms, 2);
      expect(f.tiltDeg).toBeCloseTo(Math.max(-30, Math.min(30, t.tilt)), 1);
    }
  });
  it('les silhouettes retenues dans la galerie sont CONSOMMÉES : style, inclinaison, fraction haute identiques à l’ajustement', () => {
    const kept = extraEyeRecipes().filter((r) => r.ref); expect(kept.length).toBeGreaterThanOrEqual(5);
    for (const r of kept) { const f = REF_FITS.find((x) => x.id === r.ref)!; const e = generateExtraEye(r.index) as any; expect(e.shape.style).toBe(f.style); expect(e.shape.tiltDeg).toBeCloseTo(f.tiltDeg, 6); expect(e.shape.upperFraction).toBeCloseTo(f.upperFraction, 6); }
  });
  it('les limites sont documentées, pas masquées : la fraction haute du schéma (≥ 0,4) borne les sprites plats mesurés à 0,22–0,28', () => {
    expect(Math.min(...REF_FITS.map((f) => f.measuredUpperFraction))).toBeLessThan(0.4); expect(Math.min(...REF_FITS.map((f) => f.upperFraction))).toBeGreaterThanOrEqual(0.4);
  });
});
