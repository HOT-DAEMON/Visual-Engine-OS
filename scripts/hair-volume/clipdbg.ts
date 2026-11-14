import { subjectOf } from './subject';
import { inHair, hairShellMesh, shellPoint } from '../../src/head-turntable/hair-shell';
import type { CleanStyle } from '../lib/hair-faces';
const s = subjectOf('long' as CleanStyle, 1, { seed: 4 }).spec, v = s.hairVolume!;
for (const y of [0.85, 0.95, 1.05, 1.15, 1.25]) console.log(y, 'in@180', inHair(s, v, 180, y, 0.0015), 'in@170', inHair(s, v, 170, y, 0.0015), 'in@-175', inHair(s, v, -175, y), 'pt', JSON.stringify(shellPoint(s, v, y, Math.PI)));
const m = hairShellMesh(s, v); console.log('verts', m.P.length, 'tris', m.T.length);
