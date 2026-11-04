/**
 * CALAGE DE LA LISIÈRE DES CHEVEUX sur les masques de cheveux de la planche (recouvrement IoU). Descente par coordonnées sur les hauteurs des nœuds de
 * `REF_SPEC.hairline` ; calage sur les lacets 0, 45, 90, 135, 180 ; les lacets 20, 70, 110, 160 restent HORS échantillon et sont rapportés.
 * Préalable : python3 scripts/head-turntable/export-hair-masks.py .scratch/refhair  — Usage : npx tsx scripts/head-turntable/fit-hairline.ts .scratch/refhair
 */
import { readFileSync } from 'node:fs';
import { defaultFrame, REF_SPEC, refView, renderHead, REGION, topRow, type HeadTurnSpec } from '../../src/head-turntable';

const dir = process.argv[2] ?? '.scratch/refhair', frame = defaultFrame(520);
const FIT = [0, 45, 90, 135, 180], HOLD = [20, 70, 110, 160];
const masks = new Map<number, Uint8Array>([...FIT, ...HOLD].map((y) => [y, new Uint8Array(readFileSync(`${dir}/hair_${y}.bin`))]));
// Le masque de planche est exporté avec son sommet à 0,2 ppu ; le vrai sommet du rendu en diffère de quelques px (tangage) : on décale le masque de la différence.
const iou = (spec: HeadTurnSpec, yaw: number): number => {
  const r = renderHead(refView(yaw), spec, { frame, ss: 1 }), ref = masks.get(yaw)!, dy = topRow(r) - Math.round(0.2 * frame.ppu);
  let i = 0, u = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const k = y * r.w + x, yr = y - dy, a = r.regions[k] === REGION.hair && r.ids[k]! > 0, b = yr >= 0 && yr < r.h && ref[yr * r.w + x] === 1;
    if (a || b) u++; if (a && b) i++;
  }
  return u ? i / u : 1;
};
const mean = (spec: HeadTurnSpec, ys: number[]): number => ys.reduce((s, y) => s + iou(spec, y), 0) / ys.length;
const withKnots = (k: [number, number][]): HeadTurnSpec => ({ ...REF_SPEC, hairline: { knots: k } });
let knots = REF_SPEC.hairline.knots.map((k) => [k[0], k[1]] as [number, number]);
console.log('départ : calage', mean(withKnots(knots), FIT).toFixed(3), 'hors échantillon', mean(withKnots(knots), HOLD).toFixed(3));
for (const step of [0.04, 0.02, 0.01]) for (let pass = 0; pass < 2; pass++) for (let i = 0; i < knots.length; i++) {
  let best = mean(withKnots(knots), FIT);
  for (const d of [-step, step]) {
    const trial = knots.map((k, j) => (j === i ? ([k[0], k[1] + d] as [number, number]) : k));
    const s = mean(withKnots(trial), FIT);
    if (s > best + 1e-4) { best = s; knots = trial; }
  }
}
console.log('final  : calage', mean(withKnots(knots), FIT).toFixed(3), 'hors échantillon', mean(withKnots(knots), HOLD).toFixed(3));
for (const y of [...FIT, ...HOLD].sort((a, b) => a - b)) console.log(String(y).padStart(3), iou(withKnots(knots), y).toFixed(3), FIT.includes(y) ? 'calage' : 'hors-échantillon');
console.log('knots:', JSON.stringify(knots.map((k) => [k[0], +k[1].toFixed(3)])));
