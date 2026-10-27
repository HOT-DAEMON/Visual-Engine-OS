import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';

/** Planche d'yeux : une cellule par spec d'œil (objets de scène), assemblées en grille puis rastérisées (PNG). */
export interface SheetCell { readonly label: string; readonly eye: Record<string, unknown>; readonly background?: string; }

export function eyeCellSvg(eye: Record<string, unknown>, w: number, h: number, background = '#2b2f3f', id = 'e'): string {
  const r = compileScene({ width: w, height: h, background, objects: [{ kind: 'eye', id, transform: { x: w / 2, y: h / 2 + 8 }, shape: { width: w * 0.8, height: h * 0.5 }, ...eye }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

export function eyeSheetPng(cells: readonly SheetCell[], cols: number, cw = 300, ch = 240, labels = true): Buffer {
  const rows = Math.ceil(cells.length / cols);
  let body = '';
  cells.forEach((c, i) => {
    const inner = eyeCellSvg(c.eye, cw, ch, c.background, `c${i}`).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    body += `<svg x="${x}" y="${y}" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}" overflow="hidden">${inner}</svg>`;
    if (labels) body += `<text x="${x + 8}" y="${y + ch - 8}" font-family="DejaVu Sans, sans-serif" font-size="11" fill="#cfd6ee">${c.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * ch}" viewBox="0 0 ${cols * cw} ${rows * ch}">${body}</svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: labels } }).render().asPng();
}
