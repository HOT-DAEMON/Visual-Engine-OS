import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { rasterPng } from './lib/raster';
import { layout, render } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de la série 4 (`docs/HAIR-BLADES.md`) : frange en lames sans dents de requin.
 *
 *   npx tsx scripts/artefacts-hair-s4.ts render <dossier>   planches brutes (têtes entières, gros plans) + counts.json avec LE CODE COURANT
 *   npx tsx scripts/artefacts-hair-s4.ts compose            « après » = artefacts/hair-s4/apres ; « avant » = artefacts/hair-s4/avant (commit 909c134)
 *
 * Seuls des paramètres existants sont utilisés : le script tourne aussi sur l'ancien code (worktree, voir `artefacts/hair-s4/README.md`).
 * Mêmes graines, mêmes options ; aucune planche n'est retouchée.
 */
const MODE = process.argv[2] ?? 'compose';
const OUT = 'artefacts/hair-s4';
const FONT = 'Inter, DejaVu Sans, sans-serif';
const BG = '#f4f1ea';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (x: number, y: number, s: string, size = 15, fill = '#222', anchor = 'start', weight = 400): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

interface Cell { readonly label: string; readonly st: CleanStyle; readonly k: number; readonly o: Parameters<typeof hairFaceSpec>[2] }
const PINK = { color: '#e0559a', rootColor: '#4a2e1c' };
const blades = (side: 1 | -1 = 1, gap = 0.5) => ({ fringeEngine: { mode: 'blades', gap, count: 0, side, cheekLocks: false } });
const CELLS: Cell[] = [
  { label: 'afro rose, lames', st: 'afro', k: 3, o: { hair: { ...PINK, ...blades() } } },
  { label: 'braids, lames', st: 'braids', k: 2, o: { hair: blades(-1) } },
  { label: 'long rose, lames', st: 'long', k: 3, o: { hair: { ...PINK, ...blades(1, 0.35) } } },
  { label: 'short, lames', st: 'short', k: 1, o: { hair: blades(-1, 0.6) } },
  { label: 'curly, lames', st: 'curly', k: 4, o: { hair: blades() } },
  { label: 'bob, lames', st: 'bob', k: 5, o: { hair: blades(-1, 0.4) } },
  { label: 'spiky, lames', st: 'spiky', k: 6, o: { hair: blades(1, 0.3) } },
  { label: 'long, lames', st: 'long', k: 7, o: { hair: blades(-1, 0.55) } },
];
const spec = (c: Cell, i: number) => hairFaceSpec(c.st, c.k, { engine: 'v2', seed: 52000 + i * 37, identity: (i * 3) % 8, ...c.o });

function renderRaw(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const C = 4, CW = 360, CH = 480;
  const heads = layout(CELLS.length, C, CW, CH, 0.72, (i) => spec(CELLS[i]!, i));
  writeFileSync(`${dir}/tetes.png`, render(heads.objects, C * CW, 2 * CH, '', BG));
  const DW = 520, DH = 560;
  const det = layout(CELLS.length, C, DW, DH, 1.3, (i) => spec(CELLS[i]!, i));
  writeFileSync(`${dir}/details.png`, render(det.objects, C * DW, 2 * DH, '', BG));
  const counts: Record<string, number> = {};
  CELLS.forEach((c, i) => {
    const sp = spec(c, i), f = generateRandomFace(sp.seed, sp.opts), g = hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height));
    counts[c.label] = g ? g.locks.length : 0;
  });
  writeFileSync(`${dir}/counts.json`, JSON.stringify(counts, null, 1));
  console.log(`planches brutes : ${dir}`);
}

const b64 = (p: string): string => readFileSync(p).toString('base64');
const img = (p: string, x: number, y: number, w: number, h: number): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b64(p)}"/>`;
function sheet(name: string, w: number, h: number, body: string): void {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
  console.log(`${OUT}/${name}.png`);
}

/** Avant (haut) / après (bas), même graine, même cadre. */
function stacked(name: string, file: string, w: number, h: number, title: string): void {
  const top = 70, gap = 50;
  sheet(name, w, top + 2 * h + gap + 20,
    txt(20, 30, title, 20, '#111', 'start', 700) + txt(20, 56, 'AVANT (commit 909c134) — même graine, même cadre', 14, '#a33') +
    img(`${OUT}/avant/${file}`, 0, top, w, h) + txt(20, top + h + 32, 'APRÈS (code courant)', 14, '#1a6') + img(`${OUT}/apres/${file}`, 0, top + h + gap, w, h));
}

if (MODE === 'render') renderRaw(process.argv[3] ?? `${OUT}/apres`);
else {
  stacked('01-tetes-entieres-avant-apres', 'tetes.png', 1440, 960, 'Têtes entières — frange en lames : afro, tresses, longs, short, curly, bob, spiky');
  stacked('02-gros-plans-avant-apres', 'details.png', 2080, 1120, 'Gros plans — frange en lames (forme des mèches, bord inférieur)');
}
