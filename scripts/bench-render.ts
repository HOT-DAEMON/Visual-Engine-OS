/**
 * Banc de performance : mesure SÉPARÉMENT le calcul géométrique, la génération SVG, les filtres et la rastérisation.
 * Méthode (voir docs/PERF.md) :
 *   geometry / svg  : horloge d'étapes du moteur (durées exclusives), caches vidés → coût à froid ;
 *   raster (formes) : rastérisation du SVG SANS attribut `filter` ;
 *   filters         : rastérisation complète − rastérisation sans filtres ;
 * puis un second passage (caches chauds) montre ce que les caches économisent réellement.
 * Usage : npx tsx scripts/bench-render.ts [nbVisages=6] ; écrit artefacts/perf/bench.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { clearCaches, cacheStats, clock, sceneCacheStats } from '../src';
import { cellSvg } from './lib/board';
import { rasterPixels, stripFilters } from './lib/raster';

const N = Number(process.argv[2] ?? 6);
const W = 340; const H = 420;
const now = (): number => Number(process.hrtime.bigint()) / 1e6;
const SEEDS = Array.from({ length: N }, (_, i) => 1000 + i * 37);
const opts = { anatomyEngine: 'structured' } as never;

clock.enabled = true;
clearCaches();
const rows: Record<string, number | string>[] = [];
for (const seed of SEEDS) {
  clock.reset();
  const t0 = now();
  const { svg } = cellSvg({ seed, opts }, W, H);
  const compile = now() - t0;
  const snap = clock.snapshot();
  rasterPixels(stripFilters(svg)); // échauffement du moteur de rastérisation pour ne pas fausser la 1re mesure
  const t1 = now(); rasterPixels(stripFilters(svg)); const shapes = now() - t1;
  const t2 = now(); rasterPixels(svg); const full = now() - t2;
  rows.push({ seed, geometryMs: +snap.ms.geometry.toFixed(1), svgMs: +snap.ms.svg.toFixed(1), otherMs: +(compile - snap.ms.geometry - snap.ms.svg).toFixed(1), rasterShapesMs: +shapes.toFixed(0), filtersMs: +Math.max(0, full - shapes).toFixed(0), fullRasterMs: +full.toFixed(0), svgKB: +(svg.length / 1024).toFixed(0), filters: (svg.match(/<filter /g) ?? []).length });
}
// Second passage, caches chauds : même scène → le cache de scène répond.
const t3 = now(); for (const seed of SEEDS) cellSvg({ seed, opts }, W, H); const warm = (now() - t3) / N;
const avg = (k: string): number => +(rows.reduce((a, r) => a + Number(r[k]), 0) / rows.length).toFixed(1);
const summary = { faces: N, size: `${W}x${H}`, avg: { geometryMs: avg('geometryMs'), svgMs: avg('svgMs'), rasterShapesMs: avg('rasterShapesMs'), filtersMs: avg('filtersMs'), fullRasterMs: avg('fullRasterMs'), filters: avg('filters') }, warmCompileMsPerFace: +warm.toFixed(2), caches: [...cacheStats(), sceneCacheStats()] };
mkdirSync('artefacts/perf', { recursive: true });
writeFileSync('artefacts/perf/bench.json', JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
