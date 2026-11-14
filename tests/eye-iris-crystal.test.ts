import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { IrisDetail } from '../src/schema/eye-iris-pupil';

const svg = (detail: Record<string, unknown> | undefined, seed = 7): string => {
  const r = compileScene({ width: 400, height: 300, background: '#222233', objects: [{ kind: 'eye', id: 'e', seed, transform: { x: 200, y: 150 }, shape: { width: 300, height: 170 }, iris: { radius: 0.42, ...(detail ? { detail } : {}) } }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

describe('iris détaillé : facettes et bulles (briques optionnelles de iris.detail)', () => {
  it('absentes : le rendu est identique à celui de l’iris détaillé historique', () => {
    expect(svg({ density: 0.7 })).toBe(svg({ density: 0.7, facets: undefined, bubbles: undefined }));
  });
  it('facettes : count × rings quadrilatères + autant de biseaux, déterministes', () => {
    const a = svg({ facets: { count: 12, rings: 2, contrast: 0.6 } }); const base = svg({});
    const extra = count(a, /<path /g) - count(base, /<path /g);
    expect(extra).toBe((12 + 14) * 2); // couronne k : count + 2k facettes, 2 tracés chacune
    expect(svg({ facets: { count: 12, rings: 2, contrast: 0.6 } })).toBe(a);
  });
  it('bulles : exactement `count` bulles (3 éléments chacune), sans chevauchement qui en retranche', () => {
    const a = svg({ bubbles: { count: 8, size: 0.05, opacity: 1, zone: 'lower' } }); const base = svg({});
    expect(count(a, /<circle /g) - count(base, /<circle /g)).toBe(8 * 2);
    expect(count(a, /<path /g) - count(base, /<path /g)).toBe(8);
  });
  it('la graine de l’œil change la disposition (facettes et bulles)', () => {
    expect(svg({ facets: { count: 12 }, bubbles: { count: 8 } }, 1)).not.toBe(svg({ facets: { count: 12 }, bubbles: { count: 8 } }, 2));
  });
  it('schéma : bornes refusées', () => {
    expect(() => IrisDetail.parse({ facets: { count: 3 } })).toThrow();
    expect(() => IrisDetail.parse({ facets: { rings: 9 } })).toThrow();
    expect(() => IrisDetail.parse({ bubbles: { size: 0.9 } })).toThrow();
    expect(() => IrisDetail.parse({ bubbles: { zone: 'top' } })).toThrow();
  });
});
