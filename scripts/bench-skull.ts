/**
 * Banc du moteur de crâne en profil (docs/PERF-3.md). Mesure SÉPARÉMENT, à froid (caches vidés) puis à chaud :
 *   geometry+svg : `renderProfile` complet ; raster : resvg sans polices ; verify : `verifyProfile` ; comparaison : visage de FACE (compileScene + raster).
 * Usage : npx tsx scripts/bench-skull.ts [n=24] ; écrit artefacts/skull-profile/bench.json (médianes sur n têtes distinctes).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { clearCaches, clock, compileScene, generateRandomFace } from '../src';
import { generateRandomProfile } from '../src/generation/random-skull';
import { renderProfile } from '../src/skull/render';
import { verifyProfile } from '../src/verify/skull';

const N = Number(process.argv[2] ?? 24);
const now = (): number => Number(process.hrtime.bigint()) / 1e6;
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const ras = (svg: string, w: number): void => void new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: false } }).render().pixels;
const seeds = Array.from({ length: N }, (_, i) => 1000 + i * 37);
clock.enabled = true;
const rows: Record<string, number[]> = { geometryMs: [], renderColdMs: [], rasterMs: [], verifyMs: [], renderWarmMs: [], faceCompileMs: [], faceRasterMs: [], svgKB: [] };
for (const seed of seeds) {
  const p = generateRandomProfile(seed);
  clearCaches(); clock.reset();
  const t0 = now();
  const r = renderProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair, width: 640 });
  rows.renderColdMs!.push(now() - t0);
  const snap = clock.snapshot();
  rows.geometryMs!.push(snap.ms.geometry);
  rows.svgKB!.push(r.svg.length / 1024);
  ras(r.svg, 640);
  const t1 = now(); ras(r.svg, 640); rows.rasterMs!.push(now() - t1);
  const t2 = now(); verifyProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair }); rows.verifyMs!.push(now() - t2);
  const t3 = now(); renderProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair, width: 640 }); rows.renderWarmMs!.push(now() - t3);
  // Référence : visage de face complet, même graine, même largeur de raster.
  clearCaches();
  const f = generateRandomFace(seed, { structure: true });
  const t4 = now(); const c = compileScene({ width: Math.ceil(f.width), height: Math.ceil(f.height), objects: f.objects }); rows.faceCompileMs!.push(now() - t4);
  if (c.ok) { ras(c.svg, 640); const t5 = now(); ras(c.svg, 640); rows.faceRasterMs!.push(now() - t5); }
}
const m = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, +med(v).toFixed(2)]));
const out = { faces: N, raster: '640 px de large, sans polices système', median: m, profileTotalMs: +(m.renderColdMs! + m.rasterMs!).toFixed(2), faceTotalMs: +(m.faceCompileMs! + m.faceRasterMs!).toFixed(2) };
mkdirSync('artefacts/skull-profile', { recursive: true });
writeFileSync('artefacts/skull-profile/bench.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
