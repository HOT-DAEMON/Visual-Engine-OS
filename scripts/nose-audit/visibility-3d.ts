import { appendFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from '../nose-refs/alar-overflow';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { lightModelOfSpec, patternById } from '../../src/relief';
import { PARAMS } from './params';
import { setPath } from './visibility-lib';

/**
 * Audit de visibilité EN 3D (têtes rasées éclairées par src/relief) : mêmes paramètres, vues de trois quarts (45°) et de profil (90°).
 * Un paramètre invisible de face (profondeur de racine, courbure, projection) doit apparaître ici, sinon il est mort.
 *   npx tsx scripts/nose-audit/visibility-3d.ts
 */
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const light = lightModelOfSpec({} as never, lit as never), frame = defaultFrame(420);
const YAWS = [45, 90], SEEDS = [11, 77, 1203];
const px = (seed: number, yaw: number, edit: Record<string, unknown>): Uint8Array => {
  const host = hostOf(seed);
  host.face = { ...host.face, nose: JSON.parse(JSON.stringify(host.face.nose)) };
  for (const [p, v] of Object.entries(edit)) setPath(host.face.nose, p, v);
  const { spec } = head3dSubject(host, {} as never), { hairVolume: _h, ...bald } = spec as typeof spec & { hairVolume?: unknown };
  const r = renderHead({ yaw, pitch: 0 }, bald as typeof spec, { frame, ss: 1, background: '#ece6dc', light });
  return new Resvg(r.svg, { fitTo: { mode: 'width', value: frame.w } }).render().pixels;
};
const count = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 24) n++; return n; };
const [from, to] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? PARAMS.length)];
for (const [path, lo, hi, extra] of PARAMS.slice(from, to)) {
  const e = Object.fromEntries(Object.entries(extra ?? {}));
  const per = YAWS.map((yaw) => SEEDS.reduce((t, sd) => t + count(px(sd, yaw, { ...e, [path]: lo }), px(sd, yaw, { ...e, [path]: hi })), 0) / SEEDS.length);
  const label = path === 'dorsum.shape' ? `dorsum.shape(${String(lo)}→${String(hi)})` : path;
  appendFileSync('artefacts/nez-audit-visibilite/audit-3d.jsonl', JSON.stringify({ param: label, px45: Math.round(per[0]!), px90: Math.round(per[1]!) }) + '\n');
  console.log(label.padEnd(30), 'yaw45', String(Math.round(per[0]!)).padStart(6), 'px   yaw90', String(Math.round(per[1]!)).padStart(6), 'px');
}
