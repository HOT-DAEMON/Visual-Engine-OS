import { readFileSync } from 'node:fs';
import { mulberry32 } from '../../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../../src/generation/eye-iris-families-photo2';
import { atomMetrics } from '../lib/eye-iris-atoms';
import { irisTone } from '../lib/eye-iris-tone';

/** `npx tsx scripts/eye-refs/calibrate-atoms.ts` : métriques atomiques du moteur (5 familles photo 2) face aux références. Sert au calibrage ; les valeurs retenues sont reportées dans les familles. */
const ref = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes as Record<string, any>;
const tone = Object.fromEntries((JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as any[]).map((e) => [e.id, e.tone]));
const rc2 = extra2Recipes(); const baseIdx = rc2.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
export const famEye = (f: (typeof PHOTO2_IRIS_FAMILIES)[number]): Record<string, unknown> => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); return applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as Record<string, unknown>; };
const only = process.argv[2];
for (const f of PHOTO2_IRIS_FAMILIES) {
  if (only && f !== only) continue;
  const id = PHOTO2_IRIS_MEASURES[f].ref; const e = famEye(f); const m = atomMetrics(e); const t = irisTone(e as never); const R = ref[id]; const T = tone[id];
  console.log(`\n== ${f} (réf. ${id})`);
  console.log(` darkShare   moteur ${t.darkShare}  réf ${T.darkShare} | lum ${t.lumMean} / ${T.lumMean} | pics ${t.satPeaks} / ${T.satPeaks}`);
  console.log(` fentes      moteur ${m.slits.persistentCount} (${m.slits.meanWidthDeg}°, prof. ${m.slits.meanDepth})  réf ${R.slits?.persistentCount ?? '-'} (${R.slits?.meanWidthDeg ?? '-'}°, prof. ${R.slits?.meanDepth ?? '-'})`);
  console.log(` cellules    moteur n=${m.cells.count} méd ${m.cells.areaMedian} CV ${m.cells.areaCV} élong ${m.cells.elongationMedian} solid ${m.cells.solidityMedian}  réf n=${R.cells?.count} méd ${R.cells?.areaMedian} CV ${R.cells?.areaCV} élong ${R.cells?.elongationMedian} solid ${R.cells?.solidityMedian}`);
  console.log(` étoiles     moteur n=${m.stars.count} top4 [${m.stars.top.slice(0, 4).map((t) => t.feretOverR).join(' ')}]  réf n=${R.stars?.count} top4 [${R.stars?.top?.slice(0, 4).map((t: any) => t.feretOverR).join(' ')}]`);
  console.log(` anneau      moteur rho ${m.ring.ringRho} larg ${m.ring.ringWidthRho} tirets ${m.ring.angularDashes}  réf ${R.ring ? `rho ${R.ring.ringRho} larg ${R.ring.ringWidthRho} tirets ${R.ring.angularDashes}` : '-'}`);
}
