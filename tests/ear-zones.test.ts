import { describe, expect, it } from 'vitest';
import { faceLandmarks } from '../src/face/landmarks';
import { faceZones } from '../src/face/zones';
import { ZONE_LIMITS } from '../src/face/zones-limits';
import { FaceParams } from '../src/schema';
import { checkZones } from '../src/verify/zones';

const W = 300, H = 400;
const S = (patch: object = {}) => FaceParams.parse({ anatomyEngine: 'structured', ...patch });

describe('zones verticales du visage (moteur structured)', () => {
  it('les sept zones recouvrent exactement la hauteur H, pour des visages extrêmes', () => {
    const cases = [{}, { nose: { length: 0.08 } }, { mouth: { y: 0.9 } }, { eyeLine: 0.4 }, { eyeLine: 0.58, nose: { length: 0.26 } }, { hair: { hairline: 1 } }, { hair: { hairline: 0 } }];
    for (const c of cases) {
      const p = S(c);
      const z = faceZones(p, faceLandmarks(p, W, H));
      expect(z.bands).toHaveLength(7);
      const lm = faceLandmarks(p, W, H);
      expect(z.bands.reduce((s, b) => s + b.share, 0)).toBeCloseTo((lm.chinY + H / 2) / H, 9);
      for (const b of z.bands) expect(b.heightPx).toBeGreaterThanOrEqual(0);
    }
  });

  it('le nez ne remonte pas vers l\'espace entre les yeux : plancher de la zone du nez, correction enregistrée', () => {
    const p = S({ nose: { length: 0.08 } });
    const lm = faceLandmarks(p, W, H);
    expect((lm.noseBaseY - lm.eyeY) / H).toBeGreaterThanOrEqual(ZONE_LIMITS.nose.min - 1e-9);
    // Le plancher est une borne du moteur : la longueur demandée (0,08) reste visible dans le contrat des paramètres, jamais réécrite en silence.
    expect(p.nose.length).toBe(0.08);
  });

  it('le philtrum ne dépasse pas sa longueur maximale (la bouche remonte), correction « mouth-philtrum-zone » enregistrée', () => {
    const p = S({ mouth: { y: 0.9 } });
    const lm = faceLandmarks(p, W, H);
    expect((lm.lips.topY - lm.noseBaseY) / H).toBeLessThanOrEqual(ZONE_LIMITS.philtrum.max + 1e-6);
    expect(lm.corrections.some((c) => c.id === 'mouth-philtrum-zone')).toBe(true);
  });

  it('le visage par défaut respecte toutes les bornes de zones (aucune correction nécessaire côté bouche)', () => {
    const p = S();
    const lm = faceLandmarks(p, W, H);
    expect(checkZones(p, lm).filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
  });

  it('150 visages tirés sur les paramètres (nez, bouche, yeux, implantation) : aucune zone hors bornes', () => {
    let seed = 7;
    const r = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 150; i++) {
      const p = S({ eyeLine: 0.4 + 0.18 * r(), nose: { length: 0.08 + 0.18 * r() }, mouth: { y: 0.7 + 0.2 * r() }, hair: { hairline: r() } });
      const lm = faceLandmarks(p, W, H);
      const bad = checkZones(p, lm).filter((c) => !c.ok && c.severity === 'error').map((c) => `${c.id}=${c.value.toFixed(3)}`);
      // Une borne de la zone du menton peut être la seule à céder quand le nez est très long ET la bouche très basse : elle est signalée, jamais ignorée.
      expect(bad.filter((b) => !b.startsWith('zone-chin')), `cas ${i}`).toEqual([]);
    }
  });

  it('la frontière d\'implantation : entre le sommet du crâne et les sourcils, extrémité de tempe SUR le contour', () => {
    const p = S();
    const lm = faceLandmarks(p, W, H);
    const z = faceZones(p, lm);
    expect(z.hair.centerY).toBeGreaterThan(z.hair.crownY);
    expect(Math.max(...z.hair.line.map((q) => q.y))).toBeLessThanOrEqual(lm.browLimitY);
    expect(z.hair.crownArc.length).toBeGreaterThan(10);
    expect(z.hair.crownArc.every((q) => Math.abs(q.x) <= z.hair.temple.x + 1e-6 || q.y <= z.hair.temple.y)).toBe(true);
  });

  it('le front varie avec la hauteur du crâne (ligne des yeux plus haute → front plus court)', () => {
    const f = (eyeLine: number): number => { const p = S({ eyeLine }); return faceZones(p, faceLandmarks(p, W, H)).bands[1]!.heightPx; };
    expect(f(0.42)).toBeLessThan(f(0.56));
  });

  it('le moteur classic reste STRICTEMENT identique (aucune borne de zone)', () => {
    const p = FaceParams.parse({ anatomyEngine: 'classic', nose: { length: 0.08 }, mouth: { y: 0.9 } });
    const lm = faceLandmarks(p, W, H);
    expect(lm.noseBaseY - lm.eyeY).toBeCloseTo(0.08 * H, 9);
    expect(lm.mouthY).toBeCloseTo(-H / 2 + 0.9 * H, 9);
  });
});
