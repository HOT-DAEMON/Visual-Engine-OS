/** Recherche par coordonnées des axes du moteur qui rapprochent la silhouette de la référence : dit quels axes manquent d'amplitude. */
import { ARCHETYPES, BodyParams, type BodyInput } from '../../src/body';
import { bodyHost } from '../lib/body-host';
import { fitToRef, loadRef, silhouetteIou } from './iou';

const H = bodyHost(), ref = loadRef();
const score = (b: BodyInput): number => silhouetteIou(ref, fitToRef(ref, b, H.a, H.skin)).iou;
const set = (b: any, path: string, v: number): BodyInput => { const o = JSON.parse(JSON.stringify(b)); const ks = path.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k] ??= {}; c[ks[ks.length - 1]!] = v; return o; };
const AXES: [string, number, number][] = [['frame.shoulderWidth', -1, 1], ['frame.clavicleSlope', -1, 1], ['frame.trapezius', -1, 1], ['frame.chest', -1, 1], ['limbs.upperArm', -1, 1], ['limbs.forearm', -1, 1], ['limbs.hand', -1, 1], ['limbs.armThickness', -1, 1], ['pose.left.abduction', 0, 85], ['pose.right.abduction', 0, 85], ['posture.shoulderDrop', -1, 1]];
let cur: BodyInput = BodyParams.parse(ARCHETYPES.veryMuscular) as BodyInput, best = score(cur);
console.log('départ', best.toFixed(4));
for (let it = 0; it < 3; it++) for (const [p, lo, hi] of AXES) {
  const get = (o: any): number => p.split('.').reduce((c, k) => c?.[k], o);
  const x0 = get(cur) ?? 0, span = (hi - lo) / (it + 2);
  for (const d of [-span, -span / 2, span / 2, span]) { const v = Math.min(hi, Math.max(lo, x0 + d)), c = set(cur, p, v), sc = score(c); if (sc > best + 1e-4) { best = sc; cur = c; } }
  process.stdout.write(`${p}=${(get(cur) ?? 0).toFixed(2)} → ${best.toFixed(4)}\n`);
}
console.log(JSON.stringify(cur));
