import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import type { RibbonProfile } from '../src/hair-grammar/ribbon';
import { ribbonScene } from '../src/hair-grammar/ribbon-scene';
import { verifyRibbonAnatomy, verifyRibbonGeometry, verifyRibbonStyle } from '../src/hair-grammar/ribbon-verify';
import { compareToReference, type Gray } from '../src/hair-grammar/verify';
import { decodePng } from '../src/regression/png';

/** Test PIXEL des cellules extraites par `analyze-cell.py` : le rendu doit rester proche de la référence (garde-fou de dérive, pas preuve de ressemblance). */
const CELLS = [
  { id: '01-tousled', profile: 'src/hair-grammar/profiles/tousled.ribbons.json', ref: 'artefacts/hair-grammar/refs/h01-roi-x4.png', w: 156, h: 150, iou: 0.72, recall: 0.97 },
  { id: '02-side_sweep', profile: 'src/hair-grammar/profiles/side_sweep.ribbons.json', ref: 'artefacts/hair-grammar/refs/h02-roi-x4.png', w: 142, h: 150, iou: 0.95, recall: 0.985 },
] as const;
const gray = (png: Uint8Array, w: number, h: number): Gray => { const d = decodePng(png); return { w, h, data: Uint8Array.from({ length: w * h }, (_, i) => d.data[i * 4] as number) }; };

describe.each(CELLS)('cellule $id', (c) => {
  const P = JSON.parse(readFileSync(c.profile, 'utf8')) as RibbonProfile;
  it('vérification en trois couches : verte', () => {
    for (const r of [verifyRibbonGeometry(P), verifyRibbonAnatomy(P), verifyRibbonStyle(P)]) expect(r.checks.filter((k) => !k.ok).map((k) => k.name), r.layer).toEqual([]);
  });
  it('échelle commune : unité = hauteur de tête, identique pour toutes les cellules', () => { expect(P.frame.unit).toBe(109.5); });
  it('rendu déterministe et proche de la référence (IoU, rappel d\'encre)', () => {
    const svg = ribbonScene(P, { w: c.w, h: c.h, px: 4 });
    expect(ribbonScene(P, { w: c.w, h: c.h, px: 4 })).toBe(svg);
    const img = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: c.w * 4 } }).render();
    const rgba = img.pixels; const mine: Gray = { w: img.width, h: img.height, data: Uint8Array.from({ length: img.width * img.height }, (_, i) => Math.round(0.299 * (rgba[i * 4] as number) + 0.587 * (rgba[i * 4 + 1] as number) + 0.114 * (rgba[i * 4 + 2] as number))) };
    const ref = gray(readFileSync(c.ref), c.w * 4, c.h * 4);
    const m = compareToReference(ref, mine, 8, c.id === '01-tousled' ? 132 * 4 : c.h * 4);
    expect(m.silhouetteIoU).toBeGreaterThanOrEqual(c.iou);
    expect(m.inkRecall).toBeGreaterThanOrEqual(c.recall);
  });
});
