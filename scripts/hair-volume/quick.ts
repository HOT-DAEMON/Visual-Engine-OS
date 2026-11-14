import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePngRgba } from '../../src/core/png';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { subjectOf } from './subject';
import type { CleanStyle } from '../lib/hair-faces';

const [style = 'afro', out = '/tmp/hv', yawsS = '0,45,90,135,180', pitch = '10', seed = '9000'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const t0 = Date.now(), s = subjectOf(style as CleanStyle, 1, { seed: Number(seed) });
console.log('subject', Date.now() - t0, 'ms', 'volume', !!s.spec.hairVolume, s.spec.hairVolume ? { rows: s.spec.hairVolume.ys.length, y0: s.spec.hairVolume.ys[0], yEnd: s.spec.hairVolume.ys.at(-1), parts: s.spec.hairVolume.parts.length, hang: s.spec.hairVolume.hang } : null);
for (const yaw of yawsS.split(',').map(Number)) {
  const t = Date.now(), r = renderHead({ yaw, pitch: Number(pitch) }, s.spec, { frame: defaultFrame(520), ss: 2 });
  writeFileSync(`${out}/${style}_${yaw}.png`, encodePngRgba(r.w, r.h, r.rgba));
  console.log(style, yaw, Date.now() - t, 'ms');
}
