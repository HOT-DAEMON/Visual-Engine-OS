import { subjectOf } from './subject';
import { renderHead, refView, defaultFrame } from '../../src/head-turntable';
import type { CleanStyle } from '../lib/hair-faces';
const [style = 'long', seed = '4', yaw = '180'] = process.argv.slice(2);
const s = subjectOf(style as CleanStyle, 1, { seed: Number(seed) }).spec;
const r = renderHead(refView(Number(yaw)), s, { frame: defaultFrame(520), ss: 2 });
for (let y = 0; y < r.h; y += 20) { let line = ''; for (let x = 0; x < r.w; x += 8) line += String(r.ids[y * r.w + x] ?? 0).replace('0', '.'); console.log(String(((y - r.originY) / r.ppu).toFixed(2)).padStart(6), line); }
