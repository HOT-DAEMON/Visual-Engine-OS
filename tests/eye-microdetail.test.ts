import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene } from '../src';
import { microLod, openingGeometry, scleraMarks, scleraVessels } from '../src/geometry/eye';

const eye = (o: object = {}) => EyeSpec.parse({ kind: 'eye', id: 'e', ...o });
const geom = (e = eye()) => openingGeometry(e.shape, e.canthi);
const c = { x: 0, y: 0 };
const scene = (microdetail: unknown, seed = 3) => {
  const r = compileScene({ width: 640, height: 520, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', seed, transform: { x: 320, y: 260 }, shape: { width: 400, height: 240 }, microdetail }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};

describe('EYE-07 — microdétails de la sclère', () => {
  const V = { density: 0.9, thickness: 0.5, tint: '#c4574e' as const, visibility: 0.6, branching: 0.8 };

  it('vaisseaux : tous hors de l’iris et dans l’ouverture, déterministes, nuls à densité 0', () => {
    const e = eye(); const g = geom(e);
    const gc = { x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 };
    const rx = e.iris.radius * e.shape.height; const ry = rx * e.iris.aspect;
    const vs = scleraVessels(g, gc, rx, ry, V, 5, microLod(null));
    expect(vs.length).toBeGreaterThan(8);
    for (const v of vs) for (const p of v.pts) {
      expect(Math.hypot((p.x - gc.x) / rx, (p.y - gc.y) / ry)).toBeGreaterThanOrEqual(1.0);
      expect(p.x).toBeGreaterThanOrEqual(g.bbox.x - 1e-9); expect(p.x).toBeLessThanOrEqual(g.bbox.x + g.bbox.w + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(g.bbox.y - 1e-9); expect(p.y).toBeLessThanOrEqual(g.bbox.y + g.bbox.h + 1e-9);
    }
    expect(scleraVessels(g, gc, rx, ry, V, 5, microLod(null))).toEqual(vs);
    expect(scleraVessels(g, gc, rx, ry, V, 6, microLod(null))).not.toEqual(vs);
    expect(scleraVessels(g, gc, rx, ry, { ...V, density: 0 }, 5, microLod(null))).toHaveLength(0);
  });

  it('LOD : monotone en pixels, retire des détails sans en inventer (sous-ensemble exact)', () => {
    let prev = -1;
    for (const px of [10, 40, 60, 100, 160, 220, 500]) { const l = microLod(px); expect(l.vessels).toBeGreaterThanOrEqual(prev); prev = l.vessels; }
    expect(microLod(30).vessels).toBe(0);
    expect(microLod(null)).toEqual({ vessels: 1, fine: 1, branches: 1 });
    const e = eye(); const g = geom(e); const gc = { x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 };
    const rx = e.iris.radius * e.shape.height; const ry = rx * e.iris.aspect;
    const full = scleraVessels(g, gc, rx, ry, V, 5, microLod(null));
    const low = scleraVessels(g, gc, rx, ry, V, 5, microLod(90));
    expect(low.length).toBeLessThan(full.length);
    const key = (v: { pts: readonly { x: number; y: number }[] }) => JSON.stringify(v.pts);
    const fullKeys = new Set(full.map(key));
    for (const v of low.filter((x) => !x.branch)) expect(fullKeys.has(key(v))).toBe(true);
  });

  it('marques : hors iris, bornées à `count`, nulles si le LOD les retire', () => {
    const e = eye(); const g = geom(e); const gc = { x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 };
    const rx = e.iris.radius * e.shape.height; const ry = rx * e.iris.aspect;
    const ms = scleraMarks(g, gc, rx, ry, 8, 2, 1);
    expect(ms.length).toBeLessThanOrEqual(8);
    for (const m of ms) expect(Math.hypot((m.x - gc.x) / rx, (m.y - gc.y) / ry)).toBeGreaterThanOrEqual(1.1);
    expect(scleraMarks(g, gc, rx, ry, 8, 2, 0)).toHaveLength(0);
    void c;
  });

  it('rendu : null = inchangé ; complet = vaisseaux + film lacrymal + occlusion ; LOD bas = plus de vaisseaux', () => {
    const none = scene(null);
    expect(scene({})).not.toBe(none);
    const full = scene({ vessels: V, imperfections: 4 });
    expect(full).toContain('stroke-linecap="round"');
    expect(full).toContain('-wet');
    expect(full).toContain('-occl');
    const tiny = scene({ vessels: V, imperfections: 4, lod: { eyePixels: 30 } });
    expect(tiny.length).toBeLessThan(full.length);
    expect(scene({ vessels: V }, 3)).toBe(scene({ vessels: V }, 3));
    expect(scene({ vessels: V }, 3)).not.toBe(scene({ vessels: V }, 4));
  });

  it('film lacrymal et chroma désactivables indépendamment', () => {
    const dry = scene({ vessels: null, chroma: null, tearFilm: null, occlusion: 0 });
    expect(dry).not.toContain('-sheen');
    expect(dry).not.toContain('-wet');
  });
});
