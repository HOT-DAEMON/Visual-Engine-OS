import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../src';
import { anchorFromFace, bodyBounds, bodyGeometry, bodyMarkup, generateBody, renderBody, ARCHETYPE_NAMES } from '../src/body';
import { clearCaches, cacheStats } from '../src/perf';

/** Banc du corps : géométrie / SVG à froid et à chaud, poids, rastérisation (toile générique vs recadrée). `npx tsx scripts/bench-body.ts [dossier]` */
const out = process.argv[2];
const o = generateRandomFace(11, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects[0] as unknown as { face: Parameters<typeof anchorFromFace>[0]; width: number; height: number };
const A = anchorFromFace(o.face, o.width, o.height);
const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const time = (fn: () => unknown, n: number): number => { const xs: number[] = []; for (let i = 0; i < n; i++) { const s = performance.now(); fn(); xs.push(performance.now() - s); } return med(xs); };
const rows: Record<string, unknown>[] = [];
for (const name of ARCHETYPE_NAMES) {
  let k = 0;
  const cold = time(() => bodyGeometry({ ...generateBody(1, name), age: generateBody(1, name).age + 1e-6 * ++k }, A), 15);
  const p = generateBody(1, name);
  const geo = bodyGeometry(p, A);
  const svgCold = time(() => renderBody(geo, { skin: '#c99a76', uid: `b${++k}` }), 15);
  clearCaches(); bodyMarkup(p, A, { skin: '#c99a76' });
  const warm = time(() => bodyMarkup(p, A, { skin: '#c99a76' }), 200);
  const mk = renderBody(geo, { skin: '#c99a76' });
  const b = bodyBounds(geo), S = 0.55;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1300" width="900" height="1300"><g transform="translate(450 200) scale(${S})">${mk.back}</g></svg>`;
  const w = (b.x1 - b.x0) * S, h = (b.y1 - b.y0) * S;
  const crop = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0} ${b.y0} ${b.x1 - b.x0} ${b.y1 - b.y0}" width="${Math.round(w)}" height="${Math.round(h)}">${mk.back}</svg>`;
  const r = (s: string): number => time(() => new Resvg(s, { font: { loadSystemFonts: false } }).render().asPng(), 5);
  rows.push({ archetype: name, atoms: geo.atoms.length, geometryColdMs: +cold.toFixed(2), svgColdMs: +svgCold.toFixed(2), svgWarmMs: +warm.toFixed(4), svgKB: +(mk.back.length / 1024).toFixed(1), rasterGenericMs: +r(full).toFixed(1), rasterCroppedMs: +r(crop).toFixed(1), pixelsGenericK: 1170, pixelsCroppedK: Math.round((w * h) / 1000) });
}
console.table(rows);
const mean = (k: string): number => rows.reduce((s, r) => s + (r[k] as number), 0) / rows.length;
const summary = { archetypes: rows.length, geometryColdMs: +mean('geometryColdMs').toFixed(2), svgColdMs: +mean('svgColdMs').toFixed(2), svgWarmMs: +mean('svgWarmMs').toFixed(4), svgKB: +mean('svgKB').toFixed(1), rasterGenericMs: +mean('rasterGenericMs').toFixed(1), rasterCroppedMs: +mean('rasterCroppedMs').toFixed(1), caches: cacheStats() };
console.log(JSON.stringify(summary));
if (out) { mkdirSync(out, { recursive: true }); writeFileSync(`${out}/bench-body.json`, JSON.stringify({ summary, rows }, null, 2)); }
