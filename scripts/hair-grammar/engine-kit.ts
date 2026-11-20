import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { drawFace } from '../../src/hair-grammar/face3q';
import type { HairPainting } from '../../src/hair-grammar/paint';
import { DEFAULT_HEAD, type HeadSpec, type View } from '../../src/hair-grammar/head';

/**
 * Outillage des artefacts du MOTEUR DE CHEVEUX (grammaire) : tête entière + cheveux (calques arrière / avant / dessus), surcouches
 * de preuve en repère image, planches légendées. Les cellules ont toutes la même ROI 156×150 que la cellule 01 de la planche.
 */
export const ROI = { w: 156, h: 150 };

/** Vue de la ROI pour un lacet donné (même échelle et même centre que la vue 01). */
export const viewAt = (yaw: number, pitch = 2.7): View => ({ yaw, pitch, s: 109.5, tx: 78, ty: 91.2 });

export interface HeadOpts { readonly head?: HeadSpec; readonly under?: string; readonly over?: string; readonly face?: boolean }

/** Contenu SVG (sans balise <svg>) d'une tête entière avec ses cheveux, en repère ROI. */
export function headContent(hair: Pick<HairPainting, 'back' | 'front' | 'over'>, view: View, o: HeadOpts = {}): string {
  const f = drawFace(o.head ?? DEFAULT_HEAD, view);
  const face = o.face === false ? '' : `${f.neckBack}${f.ear}${f.skin}${f.lines}${f.eyes}`;
  return `<rect width="${ROI.w}" height="${ROI.h}" fill="#fff"/>${o.under ?? ''}${hair.back}${face}${hair.front}${hair.over}${o.over ?? ''}`;
}

export interface Panel { readonly content: string; readonly label: string; readonly w?: number; readonly h?: number }

/** Planche légendée : `cols` colonnes de cellules ROI, légende sous chaque cellule. Les polices système servent aux légendes seulement. */
export function sheetSvg(panels: readonly Panel[], cols: number, title?: string, scale = 3): string {
  const cw = (panels[0]?.w ?? ROI.w) * scale; const ch = (panels[0]?.h ?? ROI.h) * scale; const cap = 34; const top = title ? 40 : 0; const pad = 8;
  const rows = Math.ceil(panels.length / cols);
  const W = cols * (cw + pad) + pad; const H = top + rows * (ch + cap + pad) + pad;
  const cells = panels.map((p, i) => {
    const x = pad + (i % cols) * (cw + pad); const y = top + pad + Math.floor(i / cols) * (ch + cap + pad);
    const esc = p.label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<g transform="translate(${x} ${y})"><svg width="${cw}" height="${ch}" viewBox="0 0 ${p.w ?? ROI.w} ${p.h ?? ROI.h}">${p.content}</svg><rect width="${cw}" height="${ch}" fill="none" stroke="#999" stroke-width="1"/><text x="4" y="${ch + 22}" font-family="Inter, sans-serif" font-size="16" fill="#222">${esc}</text></g>`;
  }).join('');
  const t = title ? `<text x="${pad}" y="28" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="#111">${title.replace(/&/g, '&amp;')}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#f4f3f1"/>${t}${cells}</svg>`;
}

export const png = (svg: string, width?: number): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Inter' }, ...(width ? { fitTo: { mode: 'width' as const, value: width } } : {}) }).render().asPng());

export function save(path: string, data: string | Buffer): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); }
