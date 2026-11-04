import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyHost } from '../lib/body-host';
import { fitToRef, loadRef } from './iou';
import { legsIou } from './legs-iou';
const H = bodyHost(), ref = loadRef('ref-02'), raw = ARCHETYPES.veryMuscular as BodyInput;
const mk = (q: Record<string, number>) => ({ legs: { limbs: { thigh: q.thigh, shin: q.shin, thighGirth: q.tg, kneeWidth: q.kw, calfGirth: q.cg, foot: q.foot }, pose: { left: { abduction: q.ab, footTurnout: q.ft }, right: { abduction: q.ab, footTurnout: q.ft } } } });
const ev = (q: Record<string, number>) => legsIou(ref, fitToRef(ref, raw, H.a, H.skin, undefined, mk(q)));
let q: Record<string, number> = { ab: 4, ft: 12, thigh: 0, shin: 0, tg: 0, kw: 0, cg: 0, foot: 0 }, best = ev(q);
console.log('départ', JSON.stringify(q), best.iou.toFixed(3));
const lim: Record<string, [number, number, number]> = { ab: [0, 20, 3], ft: [0, 30, 6], thigh: [-1, 1, 0.4], shin: [-1, 1, 0.4], tg: [-1, 1, 0.4], kw: [-1, 1, 0.4], cg: [-1, 1, 0.4], foot: [-1, 1, 0.4] };
for (let pass = 0; pass < 2; pass++) for (const k of Object.keys(lim)) { const [lo, hi, st] = lim[k]!; for (const d of [-st, st]) { for (let i = 0; i < 4; i++) { const v = Math.min(hi, Math.max(lo, q[k]! + d)); if (v === q[k]) break; const t = { ...q, [k]: v }, r = ev(t); if (r.iou > best.iou + 0.002) { q = t; best = r; } else break; } } console.log(pass, k, JSON.stringify(q), best.iou.toFixed(3)); }
console.log('FINAL', JSON.stringify(q), JSON.stringify(best));
