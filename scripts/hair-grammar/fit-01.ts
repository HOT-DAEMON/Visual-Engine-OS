import { readFileSync, writeFileSync } from 'node:fs';
import { Synth, fitLocks } from '../../src/hair-grammar/autofit';
import { generate } from '../../src/hair-grammar/grammar';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { VIEW_01 } from '../../src/hair-grammar/views';
import { makeTarget01 } from './target-01';

/**
 * Ajuste les mèches du profil 01 sur la cellule de référence (analyse par synthèse, src/hair-grammar/autofit.ts).
 * Usage : tsx scripts/hair-grammar/fit-01.ts [itérations] [graine] [fichier de départ.json]
 * Sortie : src/hair-grammar/profiles/tousled.fitted.json (liste de LockSpec).
 */
const ITERS = Number(process.argv[2] ?? 30000); const SEED = Number(process.argv[3] ?? 7); const START = process.argv[4];
const { target, layer } = makeTarget01(2);

const synth = new Synth(TOUSLED.head, VIEW_01, target, layer);
const start = START ? JSON.parse(readFileSync(START, 'utf8')) : generate(TOUSLED, 1);
synth.load(start);
const t0 = performance.now(); const l0 = synth.loss(); const t1 = performance.now();
console.log('départ', JSON.stringify(l0), `éval ${(t1 - t0).toFixed(1)} ms, ${synth.count} mèches`);
const T = performance.now();
const res = fitLocks(TOUSLED, synth, start, { iters: ITERS, seed: SEED, maxLocks: 95, minLocks: 40, onProgress: (it, l, n) => console.log(it, `total ${l.total.toFixed(4)} rap ${l.recall.toFixed(3)} préc ${l.precision.toFixed(3)} iou ${l.iou.toFixed(3)} ton ${l.tone.toFixed(3)} n=${n} ${((performance.now() - T) / 1000).toFixed(0)}s`) });
writeFileSync('src/hair-grammar/profiles/tousled.fitted.json', JSON.stringify(res.specs));
console.log('fin', JSON.stringify(res.loss), `${((performance.now() - T) / 1000).toFixed(0)} s`);
