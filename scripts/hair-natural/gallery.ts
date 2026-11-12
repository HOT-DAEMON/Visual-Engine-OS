import { mkdirSync, writeFileSync } from 'node:fs';
import { layout, render } from '../lib/proof';
import { hairFaceSpec, type CleanStyle } from '../lib/hair-faces';

/**
 * Galerie de DIAGNOSTIC (série « cheveux naturels », `docs/HAIR-NATURAL.md`) : N têtes entières d'une coiffure, graines fixes, couleurs variées.
 *   npx tsx scripts/hair-natural/gallery.ts <style> <dossier> <étiquette> [N=12] [cols=4] [seed0=9000] [pas=71] [échelle=0.9]
 * Écrit `<dossier>/<style>-<étiquette>.png` avec LE CODE COURANT.
 */
const BG = '#f4f1ea';
const COLORS = [
  { color: '#5a3a22', rootColor: '#3a2314' }, { color: '#1c1714', rootColor: '#120e0c' }, { color: '#d8b46a', rootColor: '#8a6a35' },
  { color: '#7a2fa8', rootColor: '#2a1540' }, { color: '#c4472f', rootColor: '#4a1a10' }, { color: '#e87aa8', rootColor: '#6a2a40' },
];
const [style = 'afro', dir = 'artefacts/hair-natural', tag = 'apres', n = '12', cols = '4', s0 = '9000', step = '71', scale = '0.9'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const SC = Number(scale), N = Number(n), C = Number(cols), CW = Math.round(510 * SC), CH = Math.round(660 * SC);
const heads = layout(N, C, CW, CH, SC, (i) => hairFaceSpec(style as CleanStyle, i + 1, { engine: 'v2', seed: Number(s0) + i * Number(step), identity: i % 8, hair: COLORS[i % COLORS.length] }));
const file = `${dir}/${style}-${tag}.png`;
writeFileSync(file, render(heads.objects, C * CW, Math.ceil(N / C) * CH, '', BG));
console.log(file);
