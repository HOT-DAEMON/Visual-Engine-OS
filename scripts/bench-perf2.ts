/**
 * Banc A/B de la vitesse de génération d'image (docs/PERF-2.md). Même script exécuté sur l'arbre de BASE (avant) et sur l'arbre courant (après) :
 *   RASTER_CACHE=0 npx tsx scripts/bench-perf2.ts <étiquette> [passes=3]   → artefacts/perf-2/bench-<étiquette>.json
 * Mesures (médianes sur `passes` exécutions, 16 graines) :
 *  - pipeline_ms_170x210 : (à froid, 1re passe) génération + vérification + compilation + rastérisation PNG d'une cellule de campagne, par visage ;
 *  - raster_defaut_* : construction + rendu resvg avec les réglages PAR DÉFAUT de resvg-js (polices système chargées) ;
 *  - raster_sans_polices_* : idem avec `loadSystemFonts: false` (réglage de production).
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runSeed } from './lib/campaign-worker';
import { cellSvg } from './lib/board';

const label = process.argv[2] ?? 'apres';
const PASSES = Number(process.argv[3] ?? 3);
const SEEDS = Array.from({ length: 16 }, (_, i) => 1 + i * 5);
const med = (a: number[]): number => a.slice().sort((x, y) => x - y)[a.length >> 1] as number;
const runs: Record<string, number>[] = [];
for (let p = 0; p < PASSES; p++) {
  const out: Record<string, number> = {};
  // Pipeline À FROID : seule la 1re passe compte (les suivantes retrouvent les caches par contenu chauds et mesureraient autre chose).
  if (p === 0) { const t0 = performance.now(); for (const s of SEEDS) runSeed(s, 170, 210); out.pipeline_ms_170x210 = (performance.now() - t0) / SEEDS.length; }
  for (const [W, H] of [[170, 210], [340, 420], [680, 840]] as const) {
    const svgs = SEEDS.slice(0, 8).map((s) => cellSvg({ seed: s, opts: { structure: true } as never }, W, H).svg);
    for (const [name, font] of [['defaut', {}], ['sans_polices', { font: { loadSystemFonts: false } }]] as const) {
      const t: number[] = [];
      for (let k = 0; k < 2; k++) for (const svg of svgs) { const s0 = performance.now(); new Resvg(svg, { fitTo: { mode: 'width', value: W }, ...font }).render(); t.push(performance.now() - s0); }
      out[`raster_${name}_ms_${W}x${H}`] = med(t);
    }
  }
  runs.push(out);
}
const keys = Object.keys(runs[0] as object);
const median = Object.fromEntries(keys.map((k) => [k, +med(runs.map((r) => r[k]).filter((v): v is number => v !== undefined)).toFixed(1)]));
mkdirSync('artefacts/perf-2', { recursive: true });
writeFileSync(`artefacts/perf-2/bench-${label}.json`, JSON.stringify({ label, passes: PASSES, graines: SEEDS, mediane: median, passesBrutes: runs.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(1)]))) }, null, 1));
console.log(label, JSON.stringify(median));
