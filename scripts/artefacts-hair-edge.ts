import { mkdirSync, writeFileSync } from 'node:fs';
import { layout, render } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Planches de la série « lisière » (`docs/HAIR-EDGE.md`).
 *
 *   npx tsx scripts/artefacts-hair-edge.ts render <dossier> [gros|tete]   12 cas (longs, bob, afro, bouclé), planche brute avec LE CODE COURANT
 *   npx tsx scripts/artefacts-hair-edge.ts styles <dossier>                toutes les coiffures, 3 visages chacune (revue forme ↔ crâne)
 *
 * Mêmes graines, mêmes options pour « avant » et « après » : aucune planche n'est retouchée.
 */
const BG = '#f4f1ea';
const BROWN = { color: '#5a3a22', rootColor: '#3a2314' };
const BLACK = { color: '#1c1714', rootColor: '#120e0c' };
const BLOND = { color: '#d8b46a', rootColor: '#8a6a35' };
const PINK = { color: '#e0559a', rootColor: '#4a2e1c' };

interface Cell { readonly label: string; readonly st: CleanStyle; readonly k: number; readonly o: Parameters<typeof hairFaceSpec>[2] }
export const CELLS: Cell[] = [
  { label: 'long brun 1', st: 'long', k: 3, o: { hair: BROWN } },
  { label: 'long brun 2', st: 'long', k: 7, o: { hair: BROWN, identity: 2 } },
  { label: 'long noir', st: 'long', k: 11, o: { hair: BLACK, identity: 5 } },
  { label: 'long blond', st: 'long', k: 14, o: { hair: BLOND, identity: 3 } },
  { label: 'bob brun', st: 'bob', k: 5, o: { hair: BROWN } },
  { label: 'bob noir', st: 'bob', k: 9, o: { hair: BLACK, identity: 4 } },
  { label: 'afro noir', st: 'afro', k: 2, o: { hair: BLACK } },
  { label: 'afro rose', st: 'afro', k: 3, o: { hair: PINK } },
  { label: 'afro brun', st: 'afro', k: 6, o: { hair: BROWN, identity: 6 } },
  { label: 'curly brun', st: 'curly', k: 4, o: { hair: BROWN } },
  { label: 'curly blond', st: 'curly', k: 8, o: { hair: BLOND, identity: 1 } },
  { label: 'curly noir', st: 'curly', k: 12, o: { hair: BLACK, identity: 7 } },
];
export const spec = (c: Cell, i: number) => hairFaceSpec(c.st, c.k, { engine: 'v2', seed: 52000 + i * 41, identity: i % 8, ...c.o });

function renderRaw(dir: string, mode: string): void {
  mkdirSync(dir, { recursive: true });
  const C = 4;
  const [CW, CH, S] = mode === 'gros' ? [440, 600, 1.0] : [360, 480, 0.72];
  const rows = Math.ceil(CELLS.length / C);
  const heads = layout(CELLS.length, C, CW, CH, S, (i) => spec(CELLS[i]!, i));
  writeFileSync(`${dir}/${mode}.png`, render(heads.objects, C * CW, rows * CH, '', BG));
  console.log(`${dir}/${mode}.png`);
}

const ALL: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
function renderStyles(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const C = 6, CW = 300, CH = 400;
  const items = ALL.flatMap((st) => [0, 1, 2].map((j) => ({ st, j })));
  const heads = layout(items.length, C, CW, CH, 0.6, (i) => { const it = items[i]!; return hairFaceSpec(it.st, it.j + 1, { engine: 'v2', seed: 61000 + i * 37, identity: i % 8, hair: [BROWN, BLACK, BLOND][it.j] }); });
  writeFileSync(`${dir}/styles.png`, render(heads.objects, C * CW, Math.ceil(items.length / C) * CH, '', BG));
  console.log(`${dir}/styles.png`);
}

if (process.argv[2] === 'styles') renderStyles(process.argv[3] ?? 'artefacts/hair-edge/apres');
if (process.argv[2] === 'render') {
  const dir = process.argv[3] ?? 'artefacts/hair-edge/apres';
  renderRaw(dir, process.argv[4] ?? 'tete');
}
