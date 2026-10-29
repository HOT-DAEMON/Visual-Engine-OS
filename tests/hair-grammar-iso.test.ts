import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanPath, verifyIso } from '../src/hair-grammar/iso-verify';
import { rasterCacheStats, rasterize } from '../src/hair-grammar/render-fast';
import type { RibbonProfile } from '../src/hair-grammar/ribbon';
import { ribbonScene } from '../src/hair-grammar/ribbon-scene';

/** Bandes iso-tons précompilées (cellule 03) : vérification du rendu en trois couches, scène déterministe, rastérisation à deux qualités avec cache. */
const P = JSON.parse(readFileSync('src/hair-grammar/profiles/swept_back.ribbons.json', 'utf8')) as RibbonProfile;
const CELL = { w: 144, h: 170 };

describe('scanPath', () => {
  it('compte sous-chemins, fermetures, nœuds et dépassement', () => {
    const r = scanPath('M1 1l2 0l0 2z M5 5l1 1z', 10, 10);
    expect(r).toMatchObject({ rings: 2, closed: 2, nodes: 5, bad: 0 });
    expect(r.overflow).toBeLessThanOrEqual(0);
  });
  it('détecte un sous-chemin non fermé, un nombre illisible et un dépassement', () => {
    expect(scanPath('M1 1l2 0', 10, 10).rings - scanPath('M1 1l2 0', 10, 10).closed).toBe(1);
    expect(scanPath('M1 x', 10, 10).bad).toBe(1);
    expect(scanPath('M1 1l20 0z', 10, 10).overflow).toBeGreaterThan(5);
  });
});

describe('cellule 03 — bandes iso-tons', () => {
  it('vérification géométrique, anatomique et de style : verte', () => {
    const v = verifyIso(P, CELL);
    for (const r of [v.geometry, v.anatomy, v.style]) expect(r.checks.filter((c) => !c.ok).map((c) => c.name), r.layer).toEqual([]);
  });
  it('les cheveux ne recouvrent ni le nez ni la bouche ni l\'œil lointain ; les traits du visage sont rendus', () => {
    const m = verifyIso(P, CELL).measures;
    for (const z of ['nez', 'bouche', 'oeil_loin']) expect(m[`cheveux_dans_${z}`]).toBe(0);
    for (const z of ['nez', 'bouche', 'oeil_loin', 'oeil_proche']) expect(m[`encre_du_rendu_dans_${z}`]).toBeGreaterThan(0.03);
  });
  it('scène déterministe, un seul chemin par bande, sans filtre ni dégradé', () => {
    const a = ribbonScene(P, { w: CELL.w, h: CELL.h, px: 2 }); expect(ribbonScene(P, { w: CELL.w, h: CELL.h, px: 2 })).toBe(a);
    expect((a.match(/<path /g) ?? []).length).toBe(P.bands?.length); expect(a).not.toMatch(/filter|Gradient/);
  });
  it('les rubans restent disponibles comme couche de structure (layers = ribbons)', () => {
    const s = ribbonScene(P, { w: CELL.w, h: CELL.h, px: 1 }, undefined, undefined, 'ribbons'); expect(s.length).toBeGreaterThan(ribbonScene(P, { w: CELL.w, h: CELL.h, px: 1 }).length);
  });
});

describe('rasterize', () => {
  const svg = ribbonScene(P, { w: CELL.w, h: CELL.h, px: 1 });
  it('brouillon et final : mêmes dimensions, pixels différents (anticrénelage)', () => {
    const a = rasterize(svg, 144, 'final'); const b = rasterize(svg, 144, 'draft');
    expect([b.width, b.height]).toEqual([a.width, a.height]); expect(Buffer.compare(Buffer.from(a.rgba), Buffer.from(b.rgba))).not.toBe(0);
  });
  it('le cache renvoie le même objet au 2ᵉ appel', () => {
    const h0 = rasterCacheStats().hits; const a = rasterize(svg, 144, 'final'); const b = rasterize(svg, 144, 'final');
    expect(b).toBe(a); expect(rasterCacheStats().hits).toBeGreaterThan(h0);
  });
});
