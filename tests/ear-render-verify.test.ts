import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { composeEar, faceLandmarks } from '../src/face';
import { earViewFrame, earViewSvg } from '../src/render/face/ear/sheet';
import { FaceParams } from '../src/schema';
import { components, conchaReadability, detachedShare, earMask, earRenderChecks, type EarBox, type Raster } from '../src/verify/ear-render';
import { headShot } from '../scripts/ear-audit/lib';

const blank = (w: number, h: number, v = 255): Raster => ({ w, h, px: new Uint8Array(w * h * 4).fill(v) });
const paint = (r: Raster, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]): void => {
  const px = r.px as Uint8Array;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * r.w + x) * 4; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255; }
};
const box = (side: -1 | 1): EarBox => ({ side, x0: 0, x1: 99, y0: 0, y1: 99 });

describe('vérification du rendu de l’oreille : métriques sur des images synthétiques', () => {
  it('une oreille collée à la tête n’est pas décollée ; la même oreille à 35 px de la tête l’est (détecteur testé sur un cas défaillant connu)', () => {
    const head = blank(100, 100); paint(head, 0, 0, 49, 99, [190, 150, 120]);
    const glued = blank(100, 100); paint(glued, 0, 0, 49, 99, [190, 150, 120]); paint(glued, 50, 20, 60, 80, [150, 100, 80]);
    const floating = blank(100, 100); paint(floating, 0, 0, 49, 99, [190, 150, 120]); paint(floating, 85, 20, 95, 80, [150, 100, 80]);
    expect(detachedShare(head, earMask(glued, head, box(1)), 1, 60)).toBeLessThan(0.05);
    expect(detachedShare(head, earMask(floating, head, box(1)), 1, 60)).toBeGreaterThan(0.9);
  });
  it('les fragments flottants sont comptés comme composantes séparées', () => {
    const a = blank(100, 100), b = blank(100, 100); paint(a, 10, 10, 40, 60, [0, 0, 0]); paint(a, 70, 70, 80, 80, [0, 0, 0]);
    const m = earMask(a, b, box(1));
    expect(components(m.mask, m.w, m.h).areas).toHaveLength(2);
  });
  it('un creux plus sombre que le pavillon est lu comme conque ; un aplat uniforme ne l’est pas', () => {
    const rim = [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }], cav = [{ x: 30, y: 30 }, { x: 60, y: 30 }, { x: 60, y: 60 }, { x: 30, y: 60 }];
    const flat = blank(100, 100, 180), hollow = blank(100, 100, 180); paint(hollow, 30, 30, 60, 60, [90, 90, 90]);
    expect(conchaReadability(hollow, rim, cav).checks.find((c) => c.id === 'ear-render-concha-contrast')!.ok).toBe(true);
    expect(conchaReadability(flat, rim, cav).checks.find((c) => c.id === 'ear-render-concha-contrast')!.ok).toBe(false);
  });
});

describe('vérification du rendu de l’oreille : têtes entières rendues (aucune erreur sur des oreilles composées)', () => {
  it('12 têtes × oreilles « natural » : une seule forme par oreille, attachée à la tête, jamais un trait', () => {
    const bad: string[] = [];
    for (let i = 0; i < 12; i++) {
      const e = composeEar(5000 + i, { character: 'natural' });
      const w = headShot(11 + i, {}, { ears: e }), wo = headShot(11 + i, {}, { ears: e, noEars: true });
      const boxes = w.boxes.map((b) => ({ ...b, side: ((b.x0 + b.x1) / 2 < w.w / 2 ? -1 : 1) as -1 | 1 }));
      for (const c of earRenderChecks({ withEars: w, without: wo, boxes, headCx: w.w / 2, expected: [], exaggeration: e.style.exaggeration, look: e.style.look })) if (!c.ok && c.severity === 'error') bad.push(`${11 + i}:${c.id}=${c.value.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('vérification du rendu : la conque se lit comme un creux sur de vraies planches d’oreille', () => {
  const cases: [string, object][] = [['défaut', { engine: 'morphology', seed: 11 }], ...Array.from({ length: 8 }, (_, i) => [`natural ${5000 + i}`, { ...composeEar(5000 + i, { character: 'natural' }), engine: 'morphology' }] as [string, object])];
  it('gros plan et trois-quarts : fond de conque ≥ 8 % plus sombre que le pavillon, cavum ≥ 20 % de l’aire (garde du défaut « creux trop petit », avant : 15,7 %)', () => {
    const bad: string[] = [];
    for (const [n, e] of cases) for (const view of ['close-up', 'three-quarter'] as const) {
      const p = FaceParams.parse({ anatomyEngine: 'structured', ears: e }), lm = faceLandmarks(p, 300, 400), o = { view, width: 260, height: 360, skin: '#b98a62' } as const;
      const fr = earViewFrame(p, lm, o)!, r = new Resvg(earViewSvg(p, lm, o), { fitTo: { mode: 'width', value: 260 } }).render();
      const cav = fr.pe.structures.find((x) => x.s.id === 'cavum')!;
      const res = conchaReadability({ w: r.width, h: r.height, px: r.pixels }, fr.pe.rim.map(fr.map), cav.poly.map(fr.map));
      for (const c of res.checks) if (!c.ok) bad.push(`${n} ${view} ${c.id}=${c.value.toFixed(3)}`);
      if (res.share < 0.2 && n === 'défaut') bad.push(`défaut part de cavum ${res.share.toFixed(3)} < 0,20`);
    }
    expect(bad).toEqual([]);
  });
});
