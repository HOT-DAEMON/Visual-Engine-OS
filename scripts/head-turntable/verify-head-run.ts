import { REF_SPEC } from '../../src/head-turntable/spec';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { verifyHeadSubject, type HeadSubject } from '../../src/head-turntable/verify-head';

/** Vérifie la planche et une galerie de graines avec la couche « tête quelconque ». Usage : tsx verify-head-run.ts [graines] */
const seeds = (process.argv[2] ?? '1,2,3').split(',').filter(Boolean).map(Number);
const subjects: HeadSubject[] = [{ id: 'planche', spec: REF_SPEC }, ...seeds.map((s) => { const v = variedHead(s); return { id: `seed${s}`, spec: v.spec, lengthH: v.profile.derivation.lengthH }; })];
for (const h of subjects) {
  const r = verifyHeadSubject(h), bad = r.layers.flatMap((l) => l.checks).filter((c) => !c.ok);
  console.log(`${h.id.padEnd(8)} ${r.pass ? 'PASS' : 'FAIL'}  (${r.layers.flatMap((l) => l.checks).length} contrôles, ${bad.length} hors bornes)`);
  for (const c of bad) console.log(`   ✗ ${c.id} = ${c.value}  [${c.min}, ${c.max}]  ${c.kind}`);
}
