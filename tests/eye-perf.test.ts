import { Resvg } from '@resvg/resvg-js';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { SHADOW_BANDS, normalCdf, offsetClosed, outsideRampAlphas, shadowStrokeAlphas } from '../src/render/eye/soft-shadow';

const W = 512, H = 384;
const svgOf = (eye: object) => {
  const r = compileScene({ width: W, height: H, background: '#2b2f3f', objects: [{ kind: 'eye', id: 'e', seed: 4, transform: { x: W / 2, y: H / 2 }, shape: { width: 350, height: 200 }, ...eye }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};
const pixels = (svg: string) => new Resvg(svg).render().pixels;

/** Alpha composé de couches successives d'opacités `a` (les plus larges d'abord), vu depuis un point couvert par les couches `from…n-1`. */
const compose = (a: readonly number[], from: number): number => 1 - a.slice(from).reduce((p, x) => p * (1 - x), 1);

describe('ombres douces sans filtre (EYE-PERF)', () => {
  it('Φ : valeurs de référence', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1.96)).toBeCloseTo(1 - 0.9750021, 6);
  });

  it('rampe intérieure : l’alpha composé suit 2·a·(1 − Φ) aux milieux de bandes, strictement décroissant, dans [0, 1)', () => {
    const alpha = 0.19; // = alpha_total / 2
    const a = shadowStrokeAlphas(alpha);
    expect(a).toHaveLength(SHADOW_BANDS.length);
    for (const x of a) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
    let prev = Infinity;
    SHADOW_BANDS.forEach((b, k) => {
      const mid = (b + (k === 0 ? 0 : (SHADOW_BANDS[k - 1] as number))) / 2;
      const c = compose(a, k);
      expect(c).toBeCloseTo(Math.min(0.999, 2 * alpha * (1 - normalCdf(mid))), 6);
      expect(c).toBeLessThanOrEqual(prev + 1e-12); prev = c;
    });
  });

  it('rampe extérieure : alpha/2 au bord → alpha au loin, croissante', () => {
    const o = outsideRampAlphas(0.38);
    let prev = 0;
    for (let k = 0; k < o.length; k++) { const c = compose(o.slice(0, k + 1), 0); expect(c).toBeGreaterThanOrEqual(prev - 1e-12); prev = c; }
    expect(compose(o.slice(0, 1), 0)).toBeGreaterThan(0.38 * 0.45);
    expect(compose(o, 0)).toBeGreaterThan(0.38 * 0.97);
    expect(compose(o, 0)).toBeLessThanOrEqual(0.38 + 1e-6);
  });

  it('continuité au bord : rampe intérieure et extérieure valent ≈ alpha/2 en d = 0', () => {
    const inside = compose(shadowStrokeAlphas(0.19), 0);
    const outside = compose(outsideRampAlphas(0.38).slice(0, 1), 0);
    expect(Math.abs(inside - outside)).toBeLessThan(0.04);
  });

  it('polygone dilaté : chaque point s’éloigne du centre d’environ e (cercle test, orientation indifférente)', () => {
    const circle = Array.from({ length: 64 }, (_, i) => ({ x: 100 * Math.cos((i / 64) * 6.2832), y: 100 * Math.sin((i / 64) * 6.2832) }));
    for (const poly of [circle, [...circle].reverse()])
      for (const p of offsetClosed(poly, 5)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(105, 0);
  });

  it('mode `fast` : aucun filtre par défaut, avec microdétails ; mode `reference` : flou SVG conservé', () => {
    expect(svgOf({})).not.toContain('<filter');
    expect(svgOf({ microdetail: {} })).not.toContain('<filter');
    expect(svgOf({ renderQuality: 'reference' })).toContain('feGaussianBlur');
  });

  it('équivalence mesurée : `fast` vs `reference` — écart moyen < 0,3/255, aucun pixel > 24/255', () => {
    for (const eye of [{}, { microdetail: {} }, { headTurn: { model: 'sphere', yawDeg: 25, azimuthDeg: 22 } }]) {
      const a = pixels(svgOf({ ...eye, renderQuality: 'fast' }));
      const b = pixels(svgOf({ ...eye, renderQuality: 'reference' }));
      let sum = 0, big = 0;
      for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) { const d = Math.abs((a[i + k] as number) - (b[i + k] as number)); sum += d; if (d > 24) big++; }
      expect(sum / ((a.length / 4) * 3)).toBeLessThan(0.3);
      expect(big).toBe(0);
    }
  });

  it('vitesse : `fast` plus rapide que `reference` (mesures ENTRELACÉES pour résister à la charge ; la preuve chiffrée est scripts/bench-eyes.ts)', () => {
    const fastSvg = svgOf({ renderQuality: 'fast' });
    const refSvg = svgOf({ renderQuality: 'reference' });
    const f: number[] = [], r: number[] = [];
    for (let i = 0; i < 7; i++) {
      let t0 = performance.now(); new Resvg(refSvg).render(); r.push(performance.now() - t0);
      t0 = performance.now(); new Resvg(fastSvg).render(); f.push(performance.now() - t0);
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[3] as number;
    expect(med(f)).toBeLessThan(med(r) * 0.95); // mesuré au repos : ≈ 0,4 ; seuil volontairement lâche
  });

  it('déterminisme : mêmes entrées, même SVG, en `fast` comme en `reference`', () => {
    expect(svgOf({ renderQuality: 'fast' })).toBe(svgOf({ renderQuality: 'fast' }));
    expect(svgOf({ renderQuality: 'reference' })).toBe(svgOf({ renderQuality: 'reference' }));
  });
});
