import { writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, noseArchetype } from '../../src/face';
import { noseView } from '../../src/face/nose';
import { FaceParams } from '../../src/schema';

/**
 * Écart entre les deux estimateurs d'ellipse (restant de `docs/NOSE-REFS-REMAINING.md`) : le moteur (`equivalentEllipse`, moments d'aire de l'enveloppe) et la mesure des références
 * (`extract_04.py`, `cv2.fitEllipse` = moindres carrés sur les POINTS du contour). Ce script exporte, pour 6 nez × 3 tangages × 2 lacets, l'enveloppe du moteur et les axes de SON estimateur ;
 * `ellipse-estimators.py` ajuste ensuite cv2.fitEllipse sur le même contour et chiffre l'écart.   npx tsx scripts/nose-refs/ellipse-estimators.ts
 */
let seed = 20261114; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const noses: [string, Record<string, unknown>][] = [['défaut', {}], ['pyramide', noseArchetype('pyramide' as never)], ['cloche-ailes', noseArchetype('cloche-ailes' as never)]];
for (let i = 0; i < 3; i++) noses.push([`aléa${i + 1}`, { nose: { width: 0.12 + 0.16 * rnd(), length: 0.17 + 0.09 * rnd(), tip: { width: rnd(), roundness: rnd() }, alae: { flare: rnd(), volume: rnd() }, base: { width: -1 + 2 * rnd() } } }]);
const cases: unknown[] = [];
for (const [lab, patch] of noses) for (const pitch of [20, 40, 60]) for (const yaw of [0, 25]) {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }), g = noseGeometry(p, faceLandmarks(p, 300, 380)), v = noseView(g, pitch, yaw);
  cases.push({ nose: lab, pitch, yaw, envelope: v.envelope, engine: { major: v.ellipse.major, minor: v.ellipse.minor, angleDeg: v.ellipse.angleDeg, axisRatio: v.ellipse.axisRatio } });
}
writeFileSync('artefacts/nez-aspect-plafond/ellipse-cases.json', JSON.stringify(cases));
console.log(cases.length, 'cas exportés');
