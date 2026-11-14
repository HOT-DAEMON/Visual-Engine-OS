import { subjectOf } from './subject';
import { shellPoint, ellipseBelow } from '../../src/head-turntable/hair-shell';
import type { CleanStyle } from '../lib/hair-faces';
const [style = 'long', seed = '4'] = process.argv.slice(2);
const s = subjectOf(style as CleanStyle, 1, { seed: Number(seed) }).spec, v = s.hairVolume!;
console.log('y1', s.neck.y1, 'hang', JSON.stringify(v.hang), 'ys', v.ys[0], v.ys[v.ys.length - 1]);
for (let y = 0.9; y <= v.ys[v.ys.length - 1]! + 0.01; y += 0.05) {
  const e = ellipseBelow(s, y), pB = shellPoint(s, v, y, Math.PI), pS = shellPoint(s, v, y, Math.PI / 2 + 0.6);
  console.log(y.toFixed(2), 'ell a', e.a.toFixed(3), 'b', e.b.toFixed(3), 'zc', e.zc.toFixed(3), '| hair back z', pB.z.toFixed(3), 'needed', (e.zc - e.b).toFixed(3), '| side x', pS.x.toFixed(3));
}
