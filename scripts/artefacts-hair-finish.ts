import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { rasterPng } from './lib/raster';
import { layout, render } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de la série « finitions » (`docs/HAIR-FORM-ROOTS.md`, `-FRINGE.md`, `-DOMES.md`, `-HUE.md`, `-REVIEW.md`).
 *
 *   npx tsx scripts/artefacts-hair-finish.ts render <dossier>   planches brutes (têtes entières, gros plans) + counts.json avec LE CODE COURANT
 *   npx tsx scripts/artefacts-hair-finish.ts compose            « après » = code courant ; « avant » = artefacts/hair-finish/avant/ (commit d'origine) ; rapport
 *
 * « Avant » : `git worktree add <dir> <commit>`, lien `node_modules`, ce script copié, puis `render <dir>/avant` (voir `artefacts/hair-finish/README.md`).
 * Seuls des paramètres existants sont utilisés, pour que ce script tourne aussi sur l'ancien code. Mêmes graines, mêmes options ; aucune planche n'est retouchée.
 */
const MODE = process.argv[2] ?? 'compose';
const OUT = 'artefacts/hair-finish';
const FONT = 'Inter, DejaVu Sans, sans-serif';
const BG = '#f4f1ea';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (x: number, y: number, s: string, size = 15, fill = '#222', anchor = 'start', weight = 400): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

interface Cell { readonly label: string; readonly st: CleanStyle; readonly k: number; readonly o: Parameters<typeof hairFaceSpec>[2] }
/** Teinte rose sur racine brune : le cas de `HAIR-FORM-REMAINING.md` 9. */
const PINK = { color: '#e0559a', rootColor: '#4a2e1c' };
const CELLS: Cell[] = [
  { label: 'long, rose sur racine brune', st: 'long', k: 3, o: { hair: PINK } },
  { label: 'short, frange droite', st: 'short', k: 1, o: { fringe: 'straight' } },
  { label: 'short, frange rideau', st: 'short', k: 5, o: { fringe: 'curtain' } },
  { label: 'ponytail', st: 'ponytail', k: 6, o: {} },
  { label: 'bun', st: 'bun', k: 8, o: {} },
  { label: 'braids', st: 'braids', k: 2, o: {} },
  { label: 'buzz', st: 'buzz', k: 6, o: {} },
  { label: 'afro, rose sur racine brune', st: 'afro', k: 3, o: { hair: PINK } },
];
const spec = (c: Cell, i: number) => hairFaceSpec(c.st, c.k, { engine: 'v2', seed: 31000 + i * 37, identity: i % 8, ...c.o });

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
    txt(20, 30, title, 20, '#111', 'start', 700) + txt(20, 56, 'AVANT (commit d\'origine) — même graine, même cadre', 14, '#a33') +
    img(`${OUT}/avant/${file}`, 0, top, w, h) + txt(20, top + h + 32, 'APRÈS (code courant)', 14, '#1a6') + img(`${OUT}/apres/${file}`, 0, top + h + gap, w, h));
}

async function report(): Promise<void> {
  const { checkHairForm } = await import('../src/verify/hair-form');
  const { checkHairCoherence } = await import('../src/verify/hair-coherence');
  const { HAIR_STYLES } = await import('../src/schema');
  const styles = HAIR_STYLES.filter((s) => s !== 'bald') as CleanStyle[];
  const N = 20;
  const tot = new Map<string, { layer: string; n: number; bad: number; worst: number }>();
  let faces = 0;
  for (const st of styles) for (let k = 0; k < N; k++) {
    const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 41000 + k * 31 + styles.indexOf(st) * 5 }), f = generateRandomFace(sp.seed, sp.opts);
    faces++;
    for (const c of [...checkHairForm(f), ...checkHairCoherence(f)]) {
      const r = tot.get(c.id) ?? { layer: c.layer, n: 0, bad: 0, worst: 0 };
      r.n++; if (!c.ok && c.severity === 'error') r.bad++;
      tot.set(c.id, r); void c;
    }
  }
  const rows = [...tot.entries()].sort((a, b) => a[1].layer.localeCompare(b[1].layer) || a[0].localeCompare(b[0]));
  const L = [`# Rapport de vérification — série finitions`, '', `${faces} visages (${styles.length} coiffures × ${N}), graine 41000 + 31 k + 5 · rang de la coiffure. Contrôles de \`hair-form\` et \`hair-coherence\` ; « échecs » = erreurs (les avertissements sont ignorés).`, '', '| couche | contrôle | visages jugés | échecs |', '|---|---|---|---|', ...rows.map(([id, r]) => `| ${r.layer} | \`${id}\` | ${r.n} | ${r.bad} |`), ''];
  const b: Record<string, number> = JSON.parse(readFileSync(`${OUT}/avant/counts.json`, 'utf8')), a: Record<string, number> = JSON.parse(readFileSync(`${OUT}/apres/counts.json`, 'utf8'));
  L.push('## Nombre de formes par visage des planches (avant → après)', '', '| visage | avant | après |', '|---|---|---|', ...Object.keys(a).map((k) => `| ${k} | ${b[k] ?? '?'} | ${a[k]} |`), '');
  writeFileSync(`${OUT}/rapport-verification.md`, L.join('\n'));
  console.log(`rapport : ${OUT}/rapport-verification.md`);
}

if (MODE === 'render') renderRaw(process.argv[3] ?? `${OUT}/apres`);
else {
  stacked('01-tetes-entieres-avant-apres', 'tetes.png', 1440, 960, 'Têtes entières — rose sur racine brune, franges, queue, chignon, tresses, coupe rase, afro');
  stacked('02-gros-plans-avant-apres', 'details.png', 2080, 1120, 'Gros plans — repousse, frange, dômes (stries et chaume), teinte des étages');
  void report();
}
