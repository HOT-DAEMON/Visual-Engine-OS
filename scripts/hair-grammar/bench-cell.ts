import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import type { RibbonProfile } from '../../src/hair-grammar/ribbon';
import { ribbonScene } from '../../src/hair-grammar/ribbon-scene';
import { rasterize, rasterCacheStats } from '../../src/hair-grammar/render-fast';

/** Mesure SÉPARÉMENT chaque étape : construction du SVG, analyse + rastérisation (resvg `render`), encodage PNG, conversion en gris.
 *  Usage : `npx tsx scripts/hair-grammar/bench-cell.ts <profil.json> <w> <h> [auto|bands|ribbons]` — médiane de 30 passes après 5 d'échauffement, machine à 1 cœur. */
const [PROF, W, H, LAY] = process.argv.slice(2) as [string, string, string, 'auto' | 'bands' | 'ribbons' | undefined];
const P = JSON.parse(readFileSync(PROF, 'utf8')) as RibbonProfile; const w = Number(W); const h = Number(H);
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const out: Record<string, number> = {};
for (const px of [1, 2, 4]) {
  const tb: number[] = []; const tr: number[] = []; const te: number[] = []; const tg: number[] = [];
  let kb = 0;
  for (let i = 0; i < 35; i++) {
    const t0 = performance.now(); const svg = ribbonScene(P, { w, h, px }, undefined, undefined, LAY ?? 'auto');
    const t1 = performance.now(); const img = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: w * px } }).render(); const px4 = img.pixels;
    const t2 = performance.now(); img.asPng();
    const t3 = performance.now(); const d = new Uint8Array(img.width * img.height); for (let k = 0; k < d.length; k++) d[k] = (0.299 * (px4[k * 4] as number) + 0.587 * (px4[k * 4 + 1] as number) + 0.114 * (px4[k * 4 + 2] as number)) | 0;
    const t4 = performance.now();
    if (i >= 5) { tb.push(t1 - t0); tr.push(t2 - t1); te.push(t3 - t2); tg.push(t4 - t3); } kb = svg.length / 1024;
  }
  out[`svgKo`] = Math.round(kb); out[`x${px}_construction_ms`] = +med(tb).toFixed(3); out[`x${px}_rastérisation_ms`] = +med(tr).toFixed(2); out[`x${px}_png_ms`] = +med(te).toFixed(2); out[`x${px}_gris_ms`] = +med(tg).toFixed(2);
}
// Assistant `rasterize` : qualité finale vs brouillon (sans anticrénelage) vs cache, largeur 2 × la cellule.
const svg2 = ribbonScene(P, { w, h, px: 2 }, undefined, undefined, LAY ?? 'auto');
for (const q of ['final', 'draft'] as const) {
  const t: number[] = []; for (let i = 0; i < 35; i++) { const sv = svg2 + `<!--${q}${i}-->`; const t0 = performance.now(); rasterize(sv, w * 2, q); if (i >= 5) t.push(performance.now() - t0); }
  out[`x2_${q}_raster_ms`] = +med(t).toFixed(2);
}
const th: number[] = []; for (let i = 0; i < 35; i++) { const t0 = performance.now(); rasterize(svg2, w * 2, 'final'); if (i >= 5) th.push(performance.now() - t0); }
out['x2_cache_hit_ms'] = +med(th).toFixed(4); out['cache_hits'] = rasterCacheStats().hits;
console.log(JSON.stringify(out));
