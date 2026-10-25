import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { pathBox } from '../src/core/pathbox';
import { softKit, BLUR_REACH } from '../src/render/face/soft';
import { canonical, memoPure, clearCaches, cacheStats } from '../src/perf';
import { clock } from '../src/perf';

const px = (svg: string): Uint8Array => new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels;
const maxDiff = (a: Uint8Array, b: Uint8Array): number => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!)); return m; };

describe('pathBox : boîte conservatrice', () => {
  it('contient toute la courbe de Bézier (échantillonnée) et les relatifs', () => {
    const b = pathBox('M10 10C40 -30 80 90 100 20')!;
    const P = [[10, 10], [40, -30], [80, 90], [100, 20]] as const;
    for (let t = 0; t <= 1; t += 0.01) {
      const u = 1 - t;
      const x = u ** 3 * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t ** 3 * P[3][0];
      const y = u ** 3 * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t ** 3 * P[3][1];
      expect(x).toBeGreaterThanOrEqual(b.x - 1e-9); expect(x).toBeLessThanOrEqual(b.x + b.w + 1e-9);
      expect(y).toBeGreaterThanOrEqual(b.y - 1e-9); expect(y).toBeLessThanOrEqual(b.y + b.h + 1e-9);
    }
    const rel = pathBox('m5 5l10 0 0 10-10 0z')!;
    expect(rel).toEqual({ x: 5, y: 5, w: 10, h: 10 });
    expect(pathBox('')).toBeNull();
  });
});

describe('filtres de flou : région serrée = région large (à 1/255 près) et mutualisation', () => {
  it.each([0.6, 2, 5.5])('σ=%s : tracé flou identique avec région serrée et région large', (sigma) => {
    const d = 'M40 60C70 20 110 100 150 50';
    const wide = softKit('a', 300, 200); // région large qui couvre largement le tracé (référence)
    const tight = softKit('b', 100, 100);
    const make = (kit: ReturnType<typeof softKit>, withBox: boolean): string => {
      const b = pathBox(d)!;
      const ref = kit.blur(sigma, withBox ? { x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 } : undefined);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><defs>${kit.defs.join('')}</defs><path d="${d}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" filter="${ref}"/></svg>`;
    };
    expect(maxDiff(px(make(wide, false)), px(make(tight, true)))).toBeLessThanOrEqual(2);
    expect(BLUR_REACH).toBeGreaterThanOrEqual(3.5);
  });

  it('deux éléments de même σ et de même région arrondie partagent UN seul <filter>', () => {
    const kit = softKit('k', 100, 100);
    const a = kit.stroke('M10 10L30 30', '#000', 2, 0.5, 2);
    const b = kit.stroke('M11 11L31 31', '#000', 2, 0.5, 2);
    expect(kit.stats.refs).toBe(2);
    expect(kit.stats.filters).toBe(1);
    expect(a.match(/filter="([^"]+)"/)![1]).toBe(b.match(/filter="([^"]+)"/)![1]);
  });
});

describe('caches par contenu et horloge', () => {
  it('canonical est indépendant de l\'ordre des clés ; memoPure rend le même résultat et compte hits/misses', () => {
    expect(canonical({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe(canonical({ a: [1, { d: 2 }], b: 1 }));
    clearCaches();
    let calls = 0;
    const f = memoPure('t', 'geometry', (x: { v: number }) => { calls++; return x.v * 2; });
    expect([f({ v: 2 }), f({ v: 2 }), f({ v: 3 })]).toEqual([4, 4, 6]);
    expect(calls).toBe(2);
    expect(cacheStats().find((c) => c.name === 't')).toMatchObject({ hits: 1, misses: 2 });
  });

  it('l\'horloge compte les durées EXCLUSIVES (étape imbriquée retirée du parent)', () => {
    clock.enabled = true; clock.reset();
    clock.time('svg', () => { const t = Date.now(); while (Date.now() - t < 20); clock.time('geometry', () => { const u = Date.now(); while (Date.now() - u < 30); }); });
    const s = clock.snapshot(); clock.enabled = false;
    expect(s.ms.geometry).toBeGreaterThanOrEqual(28);
    expect(s.ms.svg).toBeLessThan(s.ms.geometry);
  });
});
