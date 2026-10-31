/**
 * CALIBRAGE DE LA POSE des bras sur une référence : sépare ce qui relève de la POSE (abduction, rotation de l'avant-bras, flexion du coude, déviation
 * du poignet : des entrées) de ce qui relève de la FORME du moteur. Recherche par coordonnées, symétrique G/D. `npx tsx scripts/body-refs/calibrate-pose.ts ref-02|ref-04 [archétype]`.
 */
import { ARCHETYPES, BodyParams, type BodyInput } from '../../src/body';
import { bodyHost } from '../lib/body-host';
import { fitToRef, loadRef, silhouetteIou, type RefName } from './iou';
const rn = (process.argv[2] ?? 'ref-02') as RefName, arch = (process.argv[3] ?? 'veryMuscular') as keyof typeof ARCHETYPES, H = bodyHost(), ref = loadRef(rn);
const AX: [string, number, number, number][] = [['abduction', 0, 45, 8], ['forearmSwing', -40, 40, 8], ['elbowFlex', 0, 60, 8], ['wristDev', -30, 30, 8], ['pronation', -1, 1, 0.3]];
const mk = (base: BodyInput, pose: Record<string, number>): BodyInput => { const b: any = JSON.parse(JSON.stringify(BodyParams.parse(base))); for (const sd of ['left', 'right']) Object.assign(b.pose[sd], pose); return b; };
const score = (pose: Record<string, number>): number => silhouetteIou(ref, fitToRef(ref, mk(ARCHETYPES[arch] as BodyInput, pose), H.a, H.skin)).iou;
let pose: Record<string, number> = { abduction: 10, forearmSwing: 0, elbowFlex: 8, wristDev: 0, pronation: -0.35 }, best = score(pose);
console.log(rn, arch, 'départ IoU', best.toFixed(4));
for (let it = 0; it < 4; it++) for (const [k, lo, hi, st0] of AX) {
  const st = st0 / 2 ** it;
  for (const d of [-st, st]) { const v = Math.min(hi, Math.max(lo, pose[k]! + d)), c = { ...pose, [k]: v }, sc = score(c); if (sc > best + 1e-4) { best = sc; pose = c; } }
}
const r = silhouetteIou(ref, fitToRef(ref, mk(ARCHETYPES[arch] as BodyInput, pose), H.a, H.skin));
console.log('meilleure pose', JSON.stringify(pose), 'IoU', best.toFixed(4), 'envergure×', r.spanRatio.toFixed(3), 'épaules×', r.shoulderRatio.toFixed(3), 'erreur-largeur', (r.rowErr * 100).toFixed(1) + '%');
