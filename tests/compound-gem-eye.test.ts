import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { hexGridCenters, hexPoints } from '../src/render/compound/hex-grid';
import { gemFacets } from '../src/render/gem/facets';

function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}
const compound = (over: Record<string, unknown> = {}) => ({ kind: 'compound_eye', id: 'c', ...over });
const gem = (over: Record<string, unknown> = {}) => ({ kind: 'gem_eye', id: 'g', ...over });

describe('hexGridCenters / hexPoints (géométrie pure)', () => {
  it('tous les centres tiennent dans le disque (marge de sécurité respectée)', () => {
    const R = 100;
    const fr = 12;
    for (const c of hexGridCenters(R, fr)) {
      expect(Math.hypot(c.x, c.y)).toBeLessThanOrEqual(R - fr * 0.5);
    }
  });
  it('le centre (0,0) fait toujours partie de la grille', () => {
    const centers = hexGridCenters(100, 12);
    expect(centers.some((c) => Math.hypot(c.x, c.y) < 1e-9)).toBe(true);
  });
  it('un rayon de facette plus petit produit strictement plus de facettes', () => {
    expect(hexGridCenters(100, 8).length).toBeGreaterThan(hexGridCenters(100, 20).length);
  });
  it('hexPoints retourne 6 sommets équidistants du centre', () => {
    const pts = hexPoints({ x: 5, y: -3 }, 10);
    expect(pts).toHaveLength(6);
    for (const p of pts) expect(Math.hypot(p.x - 5, p.y + 3)).toBeCloseTo(10, 9);
  });
});

describe('gemFacets (géométrie pure)', () => {
  it('produit 2 facettes par quartier (interne + externe)', () => {
    expect(gemFacets(12, 100, 40)).toHaveLength(24);
  });
  it('est déterministe (aucun hasard, motif fixe)', () => {
    expect(gemFacets(10, 100, 40)).toEqual(gemFacets(10, 100, 40));
  });
  it('couvre tout le disque : tous les sommets sont à une distance ≤ rOuter du centre', () => {
    for (const f of gemFacets(8, 50, 20)) {
      for (const p of f.points) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(50 + 1e-6);
    }
  });
});

describe('compound_eye : schéma et rendu', () => {
  it('une entrée minimale reçoit tous les défauts et se rend sans erreur', () => {
    const svg = svgOf({ objects: [compound()] });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
  it('est déterministe (seed)', () => {
    expect(svgOf({ objects: [compound({ seed: 42 })] })).toBe(svgOf({ objects: [compound({ seed: 42 })] }));
  });
  it('une seed différente change le motif de teintes', () => {
    expect(svgOf({ objects: [compound({ seed: 1 })] })).not.toBe(svgOf({ objects: [compound({ seed: 2 })] }));
  });
  it('hérite du système de matériaux partagé (métal => rampe d\'environnement)', () => {
    const svg = svgOf({ objects: [compound({ material: { preset: 'polished_metal', color: '#c9d1d9' } })] });
    expect(svg).toContain('id="c-dome-env"');
  });
  it('se place sur un hôte comme n\'importe quel autre objet', () => {
    const r = compileScene({
      objects: [
        { kind: 'host', id: 'h', material: { preset: 'matte', color: '#6aa84f' }, anchors: [{ id: 'a' }] },
        compound({ place: { host: 'h', anchors: ['a'] } }),
      ],
    });
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.svg).not.toMatch(/NaN|Infinity/);
  });
  it('ne casse rien aux bornes (facetRadius min/max, tint 0 et 1)', () => {
    for (const facetRadius of [0.04, 0.35]) {
      for (const tint of [0, 1]) {
        const svg = svgOf({ objects: [compound({ facetRadius, tint })] });
        expect(svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

describe('gem_eye : schéma et rendu', () => {
  it('une entrée minimale reçoit tous les défauts et se rend sans erreur', () => {
    const svg = svgOf({ objects: [gem()] });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
  it('est déterministe', () => {
    expect(svgOf({ objects: [gem()] })).toBe(svgOf({ objects: [gem()] }));
  });
  it('facets différent => SVG différent (nombre de quartiers visible dans le motif)', () => {
    expect(svgOf({ objects: [gem({ facets: 6 })] })).not.toBe(svgOf({ objects: [gem({ facets: 20 })] }));
  });
  it('réutilise la géométrie d\'enveloppe de l\'œil (styles anime applicables)', () => {
    for (const style of ['almond', 'round', 'sharp', 'drooping'] as const) {
      const svg = svgOf({ objects: [gem({ shape: { style } })] });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
  it('se place sur un hôte comme n\'importe quel autre objet', () => {
    const r = compileScene({
      objects: [
        { kind: 'host', id: 'h', material: { preset: 'matte', color: '#eec9ad' }, anchors: [{ id: 'l' }, { id: 'r' }] },
        gem({ id: 'eyes', place: { host: 'h', anchors: ['l', 'r'] } }),
      ],
    });
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.svg).not.toMatch(/NaN|Infinity/);
  });
  it('ne casse rien aux bornes (facets min/max, sparkle 0 et 1)', () => {
    for (const facets of [6, 24]) {
      for (const sparkle of [0, 1]) {
        const svg = svgOf({ objects: [gem({ facets, sparkle })] });
        expect(svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

describe('scène mixte : les 6 types d\'objets ensemble', () => {
  it('eye + robot_eye + panel + host + compound_eye + gem_eye dans une seule scène, ids uniques', () => {
    const r = compileScene({
      objects: [
        { kind: 'eye', id: 'e' },
        { kind: 'robot_eye', id: 'r' },
        { kind: 'panel', id: 'p', material: { preset: 'matte', color: '#888888' } },
        { kind: 'host', id: 'h', material: { preset: 'matte', color: '#eec9ad' } },
        compound({ id: 'c' }),
        gem({ id: 'g' }),
      ],
    });
    if (!r.ok) throw new Error(r.issues.join('\n'));
    const ids = [...r.svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
