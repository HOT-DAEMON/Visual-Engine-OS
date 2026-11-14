import { describe, expect, it } from 'vitest';
import { subjectOf } from '../scripts/hair-volume/subject';
import type { CleanStyle } from '../scripts/lib/hair-faces';
import { SPIKY_CONES } from '../src/face/hair/shapes';
import { variedHairedHead } from '../src/head-turntable/engines/from-host';
import { flowShift, strandSample } from '../src/head-turntable/hair-strands';
import { fringeY, inHair, FR_AZ1 } from '../src/head-turntable/hair-shell';
import { relaxRegion, smoothRegion, type HairRegion } from '../src/head-turntable/hair-region';
import { hairFeatureAnatomyChecks, hairFeatureGeometryChecks, hairFeatureStyleChecks, styleDistinctness } from '../src/head-turntable/verify-hair-features';

const STYLES = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'] as CleanStyle[];
const at = (st: CleanStyle, seed = 9000) => subjectOf(st, 1, { seed, identity: 3 }).spec;

describe('traits de la coiffure 3D (frange, épis, flux, lisière)', () => {
  it('épis : seule la coiffure `spiky` en porte, et au moins 12', () => {
    for (const st of STYLES) {
      const n = at(st).hairVolume!.parts.filter((p) => p.kind === 'spike').length;
      if (st === 'spiky') expect(n).toBeGreaterThanOrEqual(SPIKY_CONES.min); else expect(n).toBe(0);
    }
  });

  it('couche de vérification des traits : aucun échec bloquant (10 coiffures)', () => {
    for (const st of STYLES) {
      const s = at(st), c = [...hairFeatureGeometryChecks(s), ...hairFeatureAnatomyChecks(s), ...hairFeatureStyleChecks(s)];
      expect(c.filter((x) => x.kind === 'hard' && !x.ok), st).toEqual([]);
    }
  });

  it('frange : la table est sous le sommet, au-dessus du sourcil, et les cheveux couvrent le front sous la lisière', () => {
    let seen = 0;
    for (const st of STYLES) {
      const s = at(st), v = s.hairVolume!;
      if (!v.fringe) continue;
      seen++;
      expect(Math.max(...v.fringe.y)).toBeLessThan(Math.min(s.brow.yIn, s.brow.yMid, s.brow.yOut));
      expect(fringeY(v, 0)).toBeGreaterThan(s.rows[0]!.y);
      expect(fringeY(v, FR_AZ1 + 1)).toBe(-Infinity);
      // un point juste au-dessus du bord de la frange est dans les cheveux, juste au-dessous (sous le bord) non — à moins que la lisière ne le couvre.
      const y = fringeY(v, 0);
      expect(inHair(s, v, 0, y - 0.01)).toBe(true);
    }
    expect(seen).toBeGreaterThan(3);
  });

  it('flux : le décalage des mèches est nul derrière la tête (motif périodique en azimut) et lisse', () => {
    const v = at('short').hairVolume!, N = 72;
    for (const y of [0.1, 0.3, 0.5]) {
      expect(flowShift(v, N, 120, y)).toBeCloseTo(flowShift(v, N, -120, y), 9);   // derrière : seul le tourbillon (symétrique en az) agit ; le balayage est nul
      expect(Math.abs(flowShift(v, N, 179.9, y) - flowShift(v, N, -179.9, y))).toBeLessThan(1e-9);
    }
    let jump = 0;
    for (let az = -90; az < 90; az += 1) jump = Math.max(jump, Math.abs(flowShift(v, N, az + 1, 0.3) - flowShift(v, N, az, 0.3)));
    expect(jump).toBeLessThan(0.8);
  });

  it('mèches droites : colonnes de largeurs inégales (pas un peigne)', () => {
    const v = at('short').hairVolume!, N = 72, w: number[] = [];
    let prev = 0, last = -1;
    for (let i = 0; i <= N * 20; i++) { const e = strandSample(v, i / 20, 0.3, N).edge; if (e >= 0.5 && prev < 0.5) { if (last >= 0) w.push(i / 20 - last); last = i / 20; } prev = e; }
    const m = w.reduce((a, b) => a + b, 0) / w.length, cv = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length) / m;
    expect(w.length).toBeGreaterThan(40);
    expect(cv).toBeGreaterThan(0.1);
  });

  it('distinction de face : rasé, court et en épis ne se ressemblent pas (≥ 4 % des pixels de cheveux diffèrent)', () => {
    for (const seed of [9000, 4]) {
      const sh = at('short', seed), bz = at('buzz', seed), sp = at('spiky', seed);
      expect(styleDistinctness(sh, bz)).toBeGreaterThan(0.04);
      expect(styleDistinctness(sh, sp)).toBeGreaterThan(0.04);
      expect(styleDistinctness(bz, sp)).toBeGreaterThan(0.04);
    }
  });

  it('planche de variété : une graine coiffée porte le volume de son visage (sauf chauve)', () => {
    let withVol = 0;
    for (const seed of [1, 2, 3, 8, 13]) {
      const v = variedHairedHead(seed), bald = v.profile.face.params.hair.style === 'bald';
      expect(!!v.spec.hairVolume).toBe(!bald);
      if (!bald) withVol++;
    }
    expect(withVol).toBeGreaterThan(2);
  });
});

describe('lisière : adoucissement (relaxRegion)', () => {
  const poly: HairRegion = [[-190, 0], [-190, 0.8], ...Array.from({ length: 60 }, (_, i) => [-170 + i * 0.7, 0.5 + (i === 30 ? 0.04 : 0)] as [number, number]), [190, 0.8], [190, 0]];
  it('les points artificiels du sommet et du raccord ne bougent pas', () => {
    const r = relaxRegion(poly, 10);
    expect(r.length).toBe(poly.length);
    for (let i = 0; i < poly.length; i++) if (poly[i]![1] <= 0 || Math.abs(poly[i]![0]) >= 180) expect(r[i]).toEqual(poly[i]);
  });
  it('0 passe = identité ; 10 passes réduisent une marche isolée', () => {
    expect(relaxRegion(poly, 0)).toEqual(poly);
    const r = relaxRegion(poly, 10), step = (p: HairRegion): number => p[32]![1] - p[22]![1];   // bosse au milieu (indice 32) vs voisin éloigné
    expect(step(r)).toBeLessThan(0.5 * step(poly));
  });
  it('lisse sans changer la topologie (même nombre de sommets que smoothRegion)', () => {
    expect(relaxRegion(smoothRegion(poly)).length).toBe(smoothRegion(poly).length);
  });
});
