import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALMOND_REF_SOURCES, REF_PROFILE, REF_RANGES, openingGeometry, openingProfile } from '../src/geometry/eye';
import { HIGHLIGHT_OVER_IRIS, PUPIL_OVER_IRIS } from '../src/generation/eye-iris-families';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';

interface Measured { upperProfile: number[]; lowerProfile: number[]; upperPeakAt: number; lowerPeakAt: number; pupilOverIris?: number; highlights: { rOverIris: number }[]; iris: { radiusOverOpeningHeight: number; centreAlongAxis: number } }
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, Measured>;
const norm = (v: number[]): number[] => { const m = Math.max(...v.map(Math.abs)); return v.map((x) => x / m); };
const mean = (rows: number[][]): number[] => rows[0]!.map((_, i) => rows.reduce((s, r) => s + r[i]!, 0) / rows.length);
const rms = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0) / a.length);
const almond = () => openingProfile(openingGeometry(Shape.parse({ style: 'almond' }), Canthi.parse({})));

describe('références mesurées (references/eyes/measures.json) -> moteur', () => {
  it('measures.json contient les 5 yeux tracés avec profils, iris, palettes', () => {
    for (const k of ['04', '07', '11', '10a', '10b']) { expect(M[k], k).toBeDefined(); expect(M[k]!.upperProfile).toHaveLength(21); expect(M[k]!.iris.radiusOverOpeningHeight).toBeGreaterThan(0.3); }
  });

  it('REF_PROFILE (embarqué dans le moteur) = moyenne recalculée depuis measures.json (±0,002)', () => {
    const up = mean(ALMOND_REF_SOURCES.map((k) => norm(M[k]!.upperProfile)));
    const lo = mean(ALMOND_REF_SOURCES.map((k) => norm(M[k]!.lowerProfile)));
    REF_PROFILE.upper.forEach((v, i) => expect(Math.abs(v - up[i]!)).toBeLessThan(0.002));
    REF_PROFILE.lower.forEach((v, i) => expect(Math.abs(v - lo[i]!)).toBeLessThan(0.002));
  });

  it('l’almond du moteur colle au profil de référence moyen (erreur RMS < 0,07 ; avant le recalage : 0,139)', () => {
    const p = almond();
    expect(rms(norm([...p.upper]), REF_PROFILE.upper)).toBeLessThan(0.07);
    expect(rms(norm([...p.lower]), REF_PROFILE.lower)).toBeLessThan(0.07);
  });

  it('pics de l’almond dans les plages mesurées (haut 0,41–0,60 ; creux bas 0,46–0,62)', () => {
    const p = almond();
    expect(p.upperPeakAt).toBeGreaterThanOrEqual(Math.min(...ALMOND_REF_SOURCES.map((k) => M[k]!.upperPeakAt)) - 0.01);
    expect(p.upperPeakAt).toBeLessThanOrEqual(Math.max(...ALMOND_REF_SOURCES.map((k) => M[k]!.upperPeakAt)) + 0.01);
    expect(p.lowerPeakAt).toBeGreaterThanOrEqual(Math.min(...ALMOND_REF_SOURCES.map((k) => M[k]!.lowerPeakAt)) - 0.01);
    expect(p.lowerPeakAt).toBeLessThanOrEqual(Math.max(...ALMOND_REF_SOURCES.map((k) => M[k]!.lowerPeakAt)) + 0.01);
  });

  it('plages REF_RANGES englobent les mesures de chaque œil tracé', () => {
    for (const k of ['04', '07', '11', '10a', '10b']) {
      expect(M[k]!.upperPeakAt).toBeGreaterThanOrEqual(REF_RANGES.upperPeakAt[0]); expect(M[k]!.upperPeakAt).toBeLessThanOrEqual(REF_RANGES.upperPeakAt[1]);
      expect(M[k]!.iris.centreAlongAxis).toBeGreaterThanOrEqual(REF_RANGES.irisCentreAlongAxis[0]); expect(M[k]!.iris.centreAlongAxis).toBeLessThanOrEqual(REF_RANGES.irisCentreAlongAxis[1]);
    }
  });

  it('familles d’iris : pupille et reflets dans les proportions mesurées', () => {
    const pup = Object.values(M).map((m) => m.pupilOverIris).filter((v): v is number => v !== undefined);
    expect(PUPIL_OVER_IRIS[0]).toBeLessThanOrEqual(Math.max(...pup)); expect(PUPIL_OVER_IRIS[1]).toBeGreaterThanOrEqual(Math.min(...pup));
    const prim = Object.values(M).flatMap((m) => m.highlights.slice(0, 1).map((h) => h.rOverIris));
    expect(HIGHLIGHT_OVER_IRIS.primary[0]).toBeLessThanOrEqual(Math.max(...prim)); expect(HIGHLIGHT_OVER_IRIS.primary[1]).toBeGreaterThanOrEqual(Math.min(...prim));
  });
});
