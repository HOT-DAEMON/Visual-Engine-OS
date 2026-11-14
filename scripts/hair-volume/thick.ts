import { subjectOf } from './subject';
import { shellPoint, inHair } from '../../src/head-turntable/hair-shell';
import { skullSurfacePoint } from '../../src/head-turntable/mesh';
import { headRelief } from '../../src/head-turntable/engines/head-relief';
import type { CleanStyle } from '../lib/hair-faces';
const [st = 'long', sd = '9000'] = process.argv.slice(2);
const s = subjectOf(st as CleanStyle, 1, { seed: Number(sd) }).spec, v = s.hairVolume!, rel = headRelief(s.engine), D = Math.PI / 180;
console.log('hang', JSON.stringify(v.hang), 'aMax', Math.max(...s.rows.map((r) => r.a)).toFixed(3));
for (let y = 0.02; y <= 1; y += 0.06) { let m = 0, at = 0; for (let th = -Math.PI; th < Math.PI; th += 8 * D) { if (!inHair(s, v, th / D, y, -0.01)) continue; const p = shellPoint(s, v, y, th, rel), q = skullSurfacePoint(s, rel, y, th), d = Math.hypot(p.x - q.x, p.z - q.z); if (d > m) { m = d; at = th / D; } } console.log(y.toFixed(2), m.toFixed(3), 'az', at.toFixed(0)); }
