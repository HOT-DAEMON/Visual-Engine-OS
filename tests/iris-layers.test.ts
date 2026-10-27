import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { angularCells, angularRange, blendColor, polar, radialRange, wobble, zoneOutline } from '../src/geometry/eye';
import { IrisLayer } from '../src/schema/eye-iris-layers';

const L = (o: object) => IrisLayer.parse({ color: '#3366cc', ...o });
const scene = (iris: object, seed = 1) => {
  const r = compileScene({ width: 640, height: 520, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', seed, transform: { x: 320, y: 260 }, shape: { width: 400, height: 240 }, iris }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};

describe('EYE-04 — couches de couleur de l’iris', () => {
  it('repère : 0° = haut, 90° = droite (horaire)', () => {
    expect(polar(0, 1).y).toBeCloseTo(-1, 12);
    expect(polar(90, 1).x).toBeCloseTo(1, 12);
  });

  it('plages : half = 180°, full/ring = tour complet, rayons ordonnés', () => {
    expect(angularRange(L({ mask: 'half', angleDeg: 0 }))).toEqual({ a0: -90, a1: 90, full: false });
    expect(angularRange(L({ mask: 'ring' })).full).toBe(true);
    expect(radialRange(L({ mask: 'ring', inner: 0.7, outer: 0.2 }))).toEqual({ r0: 0.2, r1: 0.7 });
  });

  it('contours : tous les points dans le disque unitaire, même très irréguliers', () => {
    for (const mask of ['full', 'ring', 'sector', 'half'] as const)
      for (const irregularity of [0, 1]) {
        const pts = zoneOutline(L({ mask, inner: 0.1, outer: 1, irregularity }), 9, 2);
        expect(pts.length).toBeGreaterThan(8);
        for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1 + 1e-9);
      }
  });

  it('graine : irrégularité reproductible, différente d’une graine à l’autre, nulle = identité', () => {
    expect(wobble(5, 0, 0.8)(33)).toBe(wobble(5, 0, 0.8)(33));
    expect(wobble(5, 0, 0.8)(33)).not.toBe(wobble(6, 0, 0.8)(33));
    expect(wobble(5, 0, 0)(33)).toBe(1);
  });

  it('gradient angulaire plein tour : sans couture, color en haut (angleDeg), color2 en bas', () => {
    const cells = angularCells(L({ mask: 'full', gradient: 'angular', color: '#0000ff', color2: '#ffcc00', angleDeg: 0 }), 36);
    expect(cells).toHaveLength(36);
    expect(cells[0]!.color).toBe(angularCells(L({ mask: 'full', gradient: 'angular', color: '#0000ff', color2: '#ffcc00' }), 36)[0]!.color);
    const top = cells[0]!.color; const bottom = cells[18]!.color;
    expect(top).not.toBe(bottom);
    // la 1re et la dernière cellule (de part et d'autre de la couture) sont voisines en couleur
    const q = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(Math.abs(q(cells[0]!.color) - q(cells[35]!.color))).toBeLessThan(60);
  });

  it('fusion émulée : multiplier assombrit, écran éclaircit, normal = couche', () => {
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(blendColor('#808080', '#808080', 'normal')).toBe('#808080');
    expect(lum(blendColor('#808080', '#808080', 'multiply'))).toBeLessThan(lum('#808080'));
    expect(lum(blendColor('#808080', '#808080', 'screen'))).toBeGreaterThan(lum('#808080'));
  });

  it('rendu : sans couche = inchangé ; avec couches = SVG valide, déterministe, sensible à la graine', () => {
    const none = scene({});
    expect(scene({ layers: [] })).toBe(none);
    const layers = [
      { color: '#2a6fdb', mask: 'full' },
      { color: '#e0b030', mask: 'ring', inner: 0.15, outer: 0.45, irregularity: 0.6 },
      { color: '#3fe0c8', mask: 'half', angleDeg: 0, gradient: 'radial', color2: '#0b3a50', glow: 0.5 },
      { color: '#2a6fdb', color2: '#e0b030', mask: 'full', gradient: 'angular', opacity: 0.5 },
      { color: '#ffffff', mask: 'spot', angleDeg: 140, inner: 0.5, outer: 0.7 },
    ];
    const a = scene({ layers }, 4);
    expect(a).not.toBe(none);
    expect(scene({ layers }, 4)).toBe(a);
    expect(scene({ layers }, 5)).not.toBe(a);
  });

  it('le schéma limite à 8 couches', () => {
    expect(() => scene({ layers: Array.from({ length: 9 }, () => ({ color: '#112233' })) })).toThrow();
  });
});
