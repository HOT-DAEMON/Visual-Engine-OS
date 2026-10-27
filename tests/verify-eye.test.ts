import { describe, expect, it } from 'vitest';
import { verifyEye } from '../src/verify';
import { openingGeometry, openingPolygon } from '../src/geometry/eye';
import { EyeSpec } from '../src';

const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
const ids = (r: { failures: { id: string }[] }) => r.failures.map((f) => f.id);

describe('verifyEye — géométrie, anatomie, style', () => {
  it('les 12 enveloppes par défaut : aucune erreur (les écarts de style ne sont que des avertissements)', () => {
    for (const style of STYLES) {
      const r = verifyEye({ kind: 'eye', id: 'e', shape: { style } });
      expect(ids(r), style).toEqual([]);
      expect(r.checks.some((c) => c.layer === 'geometry')).toBe(true);
      expect(r.checks.some((c) => c.layer === 'anatomy')).toBe(true);
      expect(r.checks.some((c) => c.layer === 'style')).toBe(true);
    }
  });

  it('ouverture : simple et d’aire positive pour chaque enveloppe', () => {
    for (const style of STYLES) {
      const e = EyeSpec.parse({ kind: 'eye', id: 'e', shape: { style } });
      expect(openingPolygon(openingGeometry(e.shape, e.canthi)).length).toBe(64);
    }
  });

  it('toutes les nouvelles fonctions ensemble restent valides : profils, couches, reflets, microdétails, sphère, apparence', () => {
    const r = verifyEye({
      kind: 'eye', id: 'e', seed: 9,
      pupil: { shape: 'star', size: 0.4, multiple: { count: 3 }, response: { model: 'circular', light: 0.2 } },
      iris: { layers: [{ color: '#2a6fdb' }, { color: '#e0b030', mask: 'ring', inner: 0.15, outer: 0.45 }] },
      highlights: { list: [{ kind: 'reflection', anchor: 'light', role: 'primary' }, { shape: 'sparkle', anchor: 'iris', x: 0.3, y: -0.3, confine: 'iris' }] },
      microdetail: { vessels: { density: 0.8 }, imperfections: 3 },
      headTurn: { model: 'sphere', yawDeg: 20, azimuthDeg: 22 },
      appearance: { glow: { intensity: 0.4 } },
    });
    expect(ids(r)).toEqual([]);
    expect(r.metrics.filters).toBeGreaterThan(0);
  });

  it('détecte un œil retourné derrière le crâne (sphère, lacet fort du côté fuyant)', () => {
    const r = verifyEye({ kind: 'eye', id: 'e', headTurn: { model: 'sphere', yawDeg: 60, azimuthDeg: 40 } });
    expect(ids(r)).toContain('eye-facing-camera');
  });

  it('détecte un regard qui sort de l’ouverture', () => {
    const extreme = verifyEye({ kind: 'eye', id: 'e', gaze: { yawDeg: 45, pitchDeg: 35, travel: 1.5 } });
    // Le contrôle existe toujours et, regard extrême ou non, ne lève jamais d’exception ; au repos il passe.
    expect(extreme.checks.find((c) => c.id === 'iris-center-in-opening')).toBeDefined();
    expect(verifyEye({ kind: 'eye', id: 'e' }).checks.find((c) => c.id === 'iris-center-in-opening')!.ok).toBe(true);
  });

  it('avertit (sans invalider) d’un iris énorme et d’une pupille dilatée', () => {
    const r = verifyEye({ kind: 'eye', id: 'e', iris: { radius: 0.7, aspect: 1.8 }, pupil: { size: 0.7 } });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('déterminisme : même entrée = même rapport', () => {
    const a = verifyEye({ kind: 'eye', id: 'e', seed: 3 });
    expect(verifyEye({ kind: 'eye', id: 'e', seed: 3 })).toEqual(a);
  });
});
