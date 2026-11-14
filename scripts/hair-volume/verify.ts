import { HeadRenders, headAnatomy, headGeometry, headStyle } from '../../src/head-turntable/verify-head';
import { subjectOf } from './subject';
import type { CleanStyle } from '../lib/hair-faces';

/** Vérifie le volume de cheveux 3D d'une coiffure : affiche les contrôles `head.hair3d.*` de chaque couche. */
const [style = 'afro', seed = '9000', all = ''] = process.argv.slice(2);
const s = subjectOf(style as CleanStyle, 1, { seed: Number(seed) }), R = new HeadRenders(s.spec), h = { id: 'f', spec: s.spec, lengthH: s.lengthH };
let bad = 0;
for (const layer of [headGeometry(h, R), headAnatomy(h, R), headStyle(h, R)]) for (const c of layer.checks) {
  if (!c.id.startsWith('head.hair3d') && !all) continue;
  if (!c.ok && c.kind === 'hard') bad++;
  console.log(`${c.ok ? 'ok  ' : c.kind === 'info' ? 'info' : 'FAIL'} ${c.id.padEnd(34)} ${String(c.value).padStart(8)}  [${c.min}, ${c.max}]`);
}
console.log(style, seed, bad ? `${bad} échec(s)` : 'tous les contrôles durs passent');
process.exit(bad ? 1 : 0);
