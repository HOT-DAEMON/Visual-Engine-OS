import { mkdirSync, writeFileSync } from 'node:fs';
import { layout, render } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Planches de la série « forme ronde et franges » (`docs/HAIR-ROUND.md`, `docs/HAIR-FRINGE-ASPECT.md`).
 *   npx tsx scripts/artefacts-hair-round.ts <dossier> <étiquette>
 * Écrit `<dossier>/<planche>-<étiquette>.png` avec LE CODE COURANT : à lancer dans un arbre « avant » (HEAD d'origine) et dans l'arbre « après » avec les MÊMES graines ;
 * aucune planche n'est retouchée. Planches : `styles` (10 coiffures × 3 visages, têtes entières), `volumes` (afro / bouclé, 6 têtes chacun), `franges` (short / spiky, 3 têtes chacun),
 * `queues` (queue de cheval et tresses : plaques aux joues).
 */
const BG = '#f4f1ea';
const BROWN = { color: '#5a3a22', rootColor: '#3a2314' };
const BLACK = { color: '#1c1714', rootColor: '#120e0c' };
const BLOND = { color: '#d8b46a', rootColor: '#8a6a35' };
const COLORS = [BROWN, BLACK, BLOND];
const ALL: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];

const [dir = 'artefacts/hair-round', tag = 'apres'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const out = (name: string, buf: Buffer): void => { writeFileSync(`${dir}/${name}-${tag}.png`, buf); console.log(`${dir}/${name}-${tag}.png`); };
// Mêmes graines que `artefacts-hair-edge.ts styles` pour pouvoir comparer aux planches existantes.
const styleSpec = (st: CleanStyle, j: number) => hairFaceSpec(st, j + 1, { engine: 'v2', seed: 61000 + (ALL.indexOf(st) * 3 + j) * 37, identity: (ALL.indexOf(st) * 3 + j) % 8, hair: COLORS[j] });

{
  const items = ALL.flatMap((st) => [0, 1, 2].map((j) => ({ st, j })));
  const C = 6, CW = 300, CH = 400;
  const heads = layout(items.length, C, CW, CH, 0.6, (i) => styleSpec(items[i]!.st, items[i]!.j));
  out('styles', render(heads.objects, C * CW, Math.ceil(items.length / C) * CH, '', BG));
}
for (const [name, st] of [['volumes', ['afro', 'curly']], ['franges', ['short', 'spiky']], ['queues', ['ponytail', 'braids']]] as const) {
  const items = st.flatMap((s) => [0, 1, 2].map((j) => ({ s: s as CleanStyle, j })));
  const C = 3, CW = 600, CH = 760;
  const heads = layout(items.length, C, CW, CH, 1.15, (i) => styleSpec(items[i]!.s, items[i]!.j));
  out(name, render(heads.objects, C * CW, 2 * CH, '', BG));
}
