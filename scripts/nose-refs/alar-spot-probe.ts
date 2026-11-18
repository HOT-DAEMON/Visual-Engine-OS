import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { lightModelOfSpec, patternById } from '../../src/relief';
import { rasterPng } from '../lib/raster';
/** Sonde de la tache claire de l'aile proche à 45° (pyramide) : rendu éclairé, nez ×4, dans un PNG. Usage : npx tsx scripts/nose-refs/alar-spot-probe.ts <graine> <type> <lacet> <sortie.png> */
const [seed = '11', type = 'pyramide', yawS = '45', out = '/tmp/w/probe.png'] = process.argv.slice(2);
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const light0 = lightModelOfSpec({} as never, lit as never), light = { ...light0, ...(process.env.NOBOUNCE ? { bounce: 0 } : {}) }, H = 420, frame = defaultFrame(H);
const sub = head3dSubject(hostOf(Number(seed), type as never), {} as never), { hairVolume: _h, ...b } = sub.spec as never as Record<string, unknown>;
const use = b as unknown as typeof sub.spec, yaw = Number(yawS);
const r = renderHead({ yaw, pitch: 0 }, use, { frame, ss: 2, background: '#ece6dc', light });
const kn = use.nose.knots, tip = kn.reduce((m, p) => (p[1] > m[1] ? p : m), kn[0]!), th = (yaw * Math.PI) / 180, ZW = 150, ZH = 110;
const cx = r.originX + -tip[1] * Math.sin(th) * r.ppu - ZW / 2, cy = r.originY + use.nose.baseY * r.ppu - ZH * 0.62;
const inner = r.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
writeFileSync(out, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${ZW}" height="${ZH}" viewBox="${cx} ${cy} ${ZW} ${ZH}">${inner}</svg>`, { fitWidth: ZW * 5 }));
console.log('ok', out);
