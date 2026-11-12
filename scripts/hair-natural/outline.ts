import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../../src';
import { faceLandmarks } from '../../src/face';
import { hairGeometry } from '../../src/face/hair';
import type { Poly } from '../../src/face/poly';

/**
 * Contour de la COQUE (`geo.base[0]`) et de la silhouette des mèches, tracés sur le contour du crâne : lit la FORME sans la couleur ni les mèches.
 *   npx tsx scripts/hair-natural/outline.ts <style> <fichier.png> [N=12] [cols=6] [seed0=9000] [pas=71]
 */
const [style = 'afro', file = 'outline.png', n = '12', cols = '6', s0 = '9000', step = '71'] = process.argv.slice(2);
const N = Number(n), C = Number(cols), CW = 300, CH = 380;
const path = (p: Poly, ox: number, oy: number): string => `M${p.map((q) => `${(q.x + ox).toFixed(1)} ${(q.y + oy).toFixed(1)}`).join('L')}Z`;
const parts: string[] = [];
for (let i = 0; i < N; i++) {
  const f = generateRandomFace(Number(s0) + i * Number(step), { hair: { style } as never, hairEngine: 'v2' });
  const lm = faceLandmarks(f.params, f.width, f.height), geo = hairGeometry(f.params, lm);
  if (!geo) continue;
  const ox = (i % C) * CW + CW / 2, oy = Math.floor(i / C) * CH + CH * 0.42;
  const S = geo.boundary.skull;
  const skull: Poly = [];
  for (let k = 0; k <= 40; k++) { const y = S.topY + ((S.chinY - S.topY) * k) / 40; skull.push({ x: S.a(y), y }); }
  for (let k = 40; k >= 0; k--) { const y = S.topY + ((S.chinY - S.topY) * k) / 40; skull.push({ x: -S.a(y), y }); }
  const k = 0.5;
  const sc = (p: Poly): Poly => p.map((q) => ({ x: q.x * k, y: q.y * k }));
  parts.push(`<path d="${path(sc(skull), ox, oy)}" fill="#e8d5bd" stroke="#555" stroke-width="1"/>`);
  parts.push(`<path d="${path(sc(geo.base[0] as Poly), ox, oy)}" fill="#7a4bd0" fill-opacity="0.45" stroke="#2a0a60" stroke-width="1.5"/>`);
  for (const l of geo.locks) if (l.layer === 'front' && l.rank !== 'hairline') parts.push(`<path d="${path(sc(l.poly), ox, oy)}" fill="#e07a30" fill-opacity="0.18" stroke="none"/>`);
  parts.push(`<text x="${ox - CW / 2 + 6}" y="${oy - CH * 0.42 + 14}" font-size="11" fill="#333">${style} ${Number(s0) + i * Number(step)}</text>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${C * CW}" height="${Math.ceil(N / C) * CH}"><rect width="100%" height="100%" fill="#f4f1ea"/>${parts.join('')}</svg>`;
mkdirSync(file.replace(/\/[^/]*$/, '') || '.', { recursive: true });
writeFileSync(file, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
console.log(file);
