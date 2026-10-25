/** Preuves visuelles de docs/PERF-2.md → artefacts/perf-2/*.png : référence vs chemin rapide, carte d'écart, tuile de bruit, graphique du banc. */
import { Resvg } from '@resvg/resvg-js';
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { setNoiseMode, noiseTileHref } from '../src/noise';
import { cellSvg } from './lib/board';

const OUT = 'artefacts/perf-2'; mkdirSync(OUT, { recursive: true });
const NOFONT = { font: { loadSystemFonts: false } } as const;
const ras = (svg: string, w: number) => new Resvg(svg, { fitTo: { mode: 'width', value: w }, ...NOFONT }).render();
const uri = (b: Uint8Array) => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const png = (svg: string, w: number, file: string) => writeFileSync(`${OUT}/${file}`, new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: true } }).render().asPng());
const label = (x: number, y: number, t: string) => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="18" fill="#222">${t}</text>`;

// 1) Référence (feTurbulence) | chemin rapide (tuile) | carte d'écart ×12, pour 3 visages à 2×.
const W = 340, H = 420; const seeds = [100, 202, 270];
let cols = '';
seeds.forEach((seed, i) => {
  const mk = () => cellSvg({ seed, opts: { structure: true } as never }, W, H).svg;
  setNoiseMode('turbulence'); const a = ras(mk(), W);
  setNoiseMode('tile'); const b = ras(mk(), W);
  // `pixels` est un getter qui COPIE l'image à chaque accès : on le lit une fois (sinon O(n²) mémoire).
  const pa = a.pixels; const pb = b.pixels; const d = new Uint8Array(pa.length);
  for (let p = 0; p < pa.length; p += 4) { let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(pa[p + c]! - pb[p + c]!)); const v = Math.min(255, m * 12); d[p] = v; d[p + 1] = v * 0.4; d[p + 2] = 255 - v; d[p + 3] = 255; }
  const diffPng = rawPng(d, a.width, a.height);
  const y = 50 + i * (H + 10);
  cols += `<image href="${uri(a.asPng())}" x="10" y="${y}" width="${W}" height="${H}"/><image href="${uri(b.asPng())}" x="${W + 20}" y="${y}" width="${W}" height="${H}"/><image href="${uri(diffPng)}" x="${2 * W + 30}" y="${y}" width="${W}" height="${H}"/>`;
});
function rawPng(rgba: Uint8Array, w: number, h: number): Uint8Array {
    const row = w * 4; const raw = Buffer.alloc((row + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (row + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * row, row).copy(raw, y * (row + 1) + 1); }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
png(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * W + 40}" height="${50 + 3 * (H + 10)}"><rect width="100%" height="100%" fill="#fff"/>${label(10, 30, 'Référence feTurbulence')}${label(W + 20, 30, 'Tuile pré-calculée (production)')}${label(2 * W + 30, 30, 'Écart ×12 (bleu = 0)')}${cols}</svg>`, 3 * W + 40, '01-reference-vs-tuile-ecart.png');

// 2) Tuile de bruit agrandie ×4 (pores graine 5, et grain graine 11).
const tiles = [noiseTileHref({ freqX: 0.908, freqY: 0.908, octaves: 2, seed: 5, offset: 0, gain: -1.2 }), noiseTileHref({ freqX: 0.85, freqY: 0.85, octaves: 2, seed: 11, offset: 0.15, gain: -1.1 })];
png(`<svg xmlns="http://www.w3.org/2000/svg" width="1070" height="560"><rect width="100%" height="100%" fill="#fff"/>${label(10, 24, 'Pores (graine 5) — 64 unités, 128 px')}${label(550, 24, 'Grain (graine 11)')}<image href="${tiles[0]}" x="10" y="40" width="512" height="512" image-rendering="pixelated"/><image href="${tiles[1]}" x="545" y="40" width="512" height="512" image-rendering="pixelated"/></svg>`, 1070, '02-tuiles-de-bruit.png');

// 3) Graphique du banc avant/après (médianes).
const A = JSON.parse(readFileSync(`${OUT}/bench-avant.json`, 'utf8')).mediane as Record<string, number>; const P = JSON.parse(readFileSync(`${OUT}/bench-apres.json`, 'utf8')).mediane as Record<string, number>;
const rows: [string, number, number][] = [['Pipeline cellule 170×210', A.pipeline_ms_170x210!, P.pipeline_ms_170x210!], ['Raster 170×210', A.raster_defaut_ms_170x210!, P.raster_sans_polices_ms_170x210!], ['Raster 340×420', A.raster_defaut_ms_340x420!, P.raster_sans_polices_ms_340x420!], ['Raster 680×840', A.raster_defaut_ms_680x840!, P.raster_sans_polices_ms_680x840!]];
const mx = Math.max(...rows.map((r) => r[1])); let bars = '';
rows.forEach(([n, a, p], i) => { const y = 70 + i * 90; bars += `${label(10, y - 6, n)}<rect x="10" y="${y}" width="${(a / mx) * 560}" height="22" fill="#b5483a"/><text x="${(a / mx) * 560 + 16}" y="${y + 17}" font-family="sans-serif" font-size="14">${a.toFixed(0)} ms</text><rect x="10" y="${y + 28}" width="${(p / mx) * 560}" height="22" fill="#2f7d5b"/><text x="${(p / mx) * 560 + 16}" y="${y + 45}" font-family="sans-serif" font-size="14">${p.toFixed(0)} ms (−${(100 * (1 - p / a)).toFixed(0)} %)</text>`; });
png(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440"><rect width="100%" height="100%" fill="#fff"/>${label(10, 28, 'Temps de génération — avant (rouge) / après (vert), médianes')}${bars}</svg>`, 720, '03-banc-avant-apres.png');
console.log('ok');
