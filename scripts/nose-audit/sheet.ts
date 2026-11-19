import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { headShot, type Engine } from './visibility-lib';
import { rasterPng } from '../lib/raster';

/**
 * Planche de preuve : pour chaque paramètre, gros plan de la zone nez→bouche (peau seule) à sa valeur BASSE, HAUTE et la DIFFÉRENCE ×6.
 *   npx tsx scripts/nose-audit/sheet.ts <sortie.png> <graine> <engine> path:lo:hi [path:lo:hi ...]
 */
const [out, seedS, eng, ...specs] = process.argv.slice(2);
const seed = Number(seedS), engine = eng as Engine, Z = 3;
const T = (x: number, y: number, s: string, fs = 13): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fs}" fill="#222">${s}</text>`;
const parse = (v: string): unknown => (Number.isNaN(Number(v)) ? v : Number(v));
let body = '', cw = 0, ch = 0;
specs.forEach((sp, r) => {
  const [path, lo, hi] = sp.split(':') as [string, string, string];
  const a = headShot(seed, engine, { [path]: parse(lo) }), b = headShot(seed, engine, { [path]: parse(hi) });
  const z = a.zone; cw = (z.x1 - z.x0) * Z; ch = (z.y1 - z.y0) * Z;
  const dif = new Uint8Array(a.px.length);
  for (let i = 0; i < a.px.length; i += 4) { const d = Math.min(255, 6 * (Math.abs(a.px[i]! - b.px[i]!) + Math.abs(a.px[i + 1]! - b.px[i + 1]!) + Math.abs(a.px[i + 2]! - b.px[i + 2]!))); dif[i] = dif[i + 1] = dif[i + 2] = 255 - d; dif[i + 3] = 255; }
  const mk = (svg: string): string => Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: a.w } }).render().asPng()).toString('base64');
  const cell = (href: string, col: number): string => `<svg x="${col * (cw + 6)}" y="${24 + r * (ch + 30)}" width="${cw}" height="${ch}" viewBox="${z.x0} ${z.y0} ${z.x1 - z.x0} ${z.y1 - z.y0}"><image width="${a.w}" height="${a.h}" href="data:image/png;base64,${href}"/></svg>`;
  // différence : PNG RGBA brut → via Resvg impossible ; on la rastérise en rectangles agrégés 1×1 sur la zone seulement
  let rects = '';
  for (let y = z.y0; y < z.y1; y++) for (let x = z.x0; x < z.x1; x++) { const i = (y * a.w + x) * 4; if (dif[i]! < 250) rects += `<rect x="${x - z.x0}" y="${y - z.y0}" width="1" height="1" fill="rgb(${dif[i]},${dif[i]},${dif[i]})"/>`; }
  const difCell = `<svg x="${2 * (cw + 6)}" y="${24 + r * (ch + 30)}" width="${cw}" height="${ch}" viewBox="0 0 ${z.x1 - z.x0} ${z.y1 - z.y0}"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
  body += cell(mk(a.svg), 0) + cell(mk(b.svg), 1) + difCell + T(2, 20 + r * (ch + 30), `${path} : ${lo} → ${hi}   (bas | haut | différence ×6)`);
});
writeFileSync(out!, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * (cw + 6)}" height="${24 + specs.length * (ch + 30)}"><rect width="100%" height="100%" fill="#ece6dc"/>${body}</svg>`, { fonts: true }));
console.log('ok', out);
