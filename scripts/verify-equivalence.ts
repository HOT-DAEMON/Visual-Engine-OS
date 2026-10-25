/**
 * Preuve d'équivalence du rendu : référence lente (`feTurbulence`) contre chemin rapide (tuile de bruit), sur 12 visages × 2 familles
 * (structure seule ; cheveux simulés), avec CONTRÔLES NÉGATIFS (décalage de 2 px, peau lissée) qui doivent échouer.
 * Écrit artefacts/perf-2/equivalence.json (ou $EQ_OUT). Taille : $W × $H (défaut 340 × 420). Usage : npx tsx scripts/verify-equivalence.ts [nbVisages=12]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { setNoiseMode } from '../src/noise';
import { equivalenceChecks, measureEquivalence, EQUIVALENCE_LIMITS, type EquivalenceMetrics } from '../src/verify';
import type { Raster } from '../src/regression/png';
import { cellSvg } from './lib/board';
import { rasterPixels } from './lib/raster';

const N = Number(process.argv[2] ?? 12);
const W = Number(process.env.W ?? 340); const H = Number(process.env.H ?? 420);
const SIM = { hair: { style: 'short', texture: 'straight', fringe: 'none', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, archetype: 'messy_bangs' }, appearance: { shading: { mode: 'cel', bands: 3, highlightBand: 0.6, castShadow: 0.8 } } }, hairEngine: 'classic' };
const families: [string, (seed: number) => never][] = [
  ['structure', (seed) => ({ seed, opts: { structure: true } }) as never],
  ['cheveux-simules', (seed) => ({ seed, opts: { structure: true, ...SIM } }) as never],
];
const raster = (svg: string): Raster => { const r = rasterPixels(svg); return { width: r.width, height: r.height, data: r.pixels }; };
const shift = (r: Raster, dx: number): Raster => { const d = new Uint8Array(r.data.length); for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const sx = Math.min(r.width - 1, Math.max(0, x - dx)); for (let c = 0; c < 4; c++) d[(y * r.width + x) * 4 + c] = r.data[(y * r.width + sx) * 4 + c]!; } return { width: r.width, height: r.height, data: d }; };
const blur3 = (r: Raster): Raster => { const d = new Uint8Array(r.data.length); for (let y = 1; y < r.height - 1; y++) for (let x = 1; x < r.width - 1; x++) for (let c = 0; c < 4; c++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += r.data[((y + j) * r.width + x + i) * 4 + c]!; d[(y * r.width + x) * 4 + c] = s / 9; } return { width: r.width, height: r.height, data: d }; };

const rows: Record<string, unknown>[] = [];
const worst: Record<string, number> = {};
const track = (m: EquivalenceMetrics): void => { for (const [k, v] of Object.entries(m)) { const key = k; worst[`${key}.min`] = Math.min(worst[`${key}.min`] ?? Infinity, v); worst[`${key}.max`] = Math.max(worst[`${key}.max`] ?? -Infinity, v); } };
let failures = 0; let negFirst: { svgA: string; svgB: string } | null = null;
for (const [fam, mk] of families) {
  for (let i = 0; i < N; i++) {
    const seed = 100 + i * 17;
    setNoiseMode('turbulence'); const a = cellSvg(mk(seed), W, H).svg; const ra = raster(a);
    setNoiseMode('tile'); const b = cellSvg(mk(seed), W, H).svg; const rb = raster(b);
    const m = measureEquivalence(ra, rb, a, b); track(m);
    const bad = equivalenceChecks(m).filter((c) => !c.ok);
    failures += bad.length;
    rows.push({ famille: fam, seed, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(5)])), echecs: bad.map((c) => c.id), svgKoRef: Math.round(a.length / 1024), svgKoOpt: Math.round(b.length / 1024) });
    if (!negFirst) negFirst = { svgA: a, svgB: b };
    if (i === 0) {
      // Contrôles négatifs sur le premier visage de la famille : chacun DOIT faire échouer au moins un contrôle.
      const neg: [string, Raster][] = [['decalage-2px', shift(rb, 2)], ['peau-lissee', blur3(rb)]];
      for (const [name, bad2] of neg) {
        const mm = measureEquivalence(ra, bad2, a, b); const fails = equivalenceChecks(mm).filter((c) => !c.ok).map((c) => c.id);
        rows.push({ famille: fam, controleNegatif: name, ...Object.fromEntries(Object.entries(mm).map(([k, v]) => [k, +v.toFixed(5)])), echecs: fails, detecte: fails.length > 0 });
        if (fails.length === 0) { failures++; console.error(`CONTRÔLE NÉGATIF NON DÉTECTÉ : ${fam} / ${name}`); }
      }
    }
  }
}
mkdirSync('artefacts/perf-2', { recursive: true });
const summary = { visages: rows.filter((r) => !r.controleNegatif).length, limites: EQUIVALENCE_LIMITS, pires: Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(5)])), echecsTotal: failures };
writeFileSync(process.env.EQ_OUT ?? 'artefacts/perf-2/equivalence.json', JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of rows.filter((x) => x.controleNegatif)) console.log('négatif', r.famille, r.controleNegatif, '→', r.detecte ? 'détecté' : 'NON DÉTECTÉ', (r.echecs as string[]).join(','));
process.exit(failures ? 1 : 0);
