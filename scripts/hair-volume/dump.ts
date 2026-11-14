import { subjectOf } from './subject';
import { sectionAt } from '../../src/head-turntable';
import type { CleanStyle } from '../lib/hair-faces';
const [style = 'long', seed = '9000'] = process.argv.slice(2);
const s = subjectOf(style as CleanStyle, 1, { seed: Number(seed) }), v = s.spec.hairVolume!;
console.log('hang', v.hang, 'kz', v.kzF, v.kzB, 'neck', s.spec.neck, 'rows0', s.spec.rows[0]);
for (let i = 0; i < v.ys.length; i += 6) { const y = v.ys[i]!, sec = sectionAt(s.spec, Math.min(y, 1.0)); console.log(y.toFixed(3), 'rL', v.rL[i]!.toFixed(3), 'rR', v.rR[i]!.toFixed(3), 'a_skull', sec.a.toFixed(3)); }
