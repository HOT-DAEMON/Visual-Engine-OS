/**
 * RECALAGE DES YEUX ET DES OREILLES À FORT TANGAGE (mesure, pas d'estimation à l'œil).
 * Pour chaque vue (tangage −60° … 60° × lacet), le centroïde des pixels RÉELLEMENT PEINTS (région `eye`, région `ear`) est comparé à la projection 3D attendue du centre de l'élément
 * (même `toCam` / `project` que la rastérisation) : l'écart (en U, hauteurs de tête) dit si l'élément est bien là où le crâne le porte. `persp` : caméra en perspective (U), absent = orthographique.
 * Usage : `npx tsx scripts/head-turntable/measure-registration.ts [persp] [graine …]` → JSON sur stdout (lu par `scripts/artefacts-face-perimeters.ts`).
 */
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { project, toCam } from '../../src/head-turntable/math';
import { sectionAt, surfaceZ } from '../../src/head-turntable/sections';
import { REGION, type HeadTurnSpec, type View } from '../../src/head-turntable/types';

export interface RegRow { readonly seed: number; readonly yaw: number; readonly pitch: number; readonly part: 'eye' | 'ear'; readonly side: 1 | -1; readonly px: number; readonly offsetU: number | null }
const FR = defaultFrame(520), RADIUS_U = 0.14, MIN_PX = 40;

/** Centre 3D attendu (repère tête) d'un œil / d'une oreille du côté `sg` (+1 : x > 0). */
function centre(spec: HeadTurnSpec, part: 'eye' | 'ear', sg: 1 | -1): { x: number; y: number; z: number } {
  if (part === 'ear') return { x: sg * spec.ear.x, y: (spec.ear.y0 + spec.ear.y1) / 2, z: spec.ear.z };
  const h = spec.eyeHost?.[sg > 0 ? 'right' : 'left'], x = h ? h.iris.cx : spec.eye.x, y = h ? h.iris.cy : spec.eye.y;
  return { x: sg * x, y, z: surfaceZ(sectionAt(spec, y), sg * x, true) };
}

export function measure(spec: HeadTurnSpec, seed: number, views: readonly View[]): RegRow[] {
  const out: RegRow[] = [];
  for (const v of views) {
    const r = renderHead(v, spec, { frame: FR, ss: 1 });
    for (const part of ['eye', 'ear'] as const) for (const sg of [1, -1] as const) {
      const c = centre(spec, part, sg), p = project(toCam(c, v, 'head'), v), ex = FR.ox + p.x * FR.ppu, ey = FR.oy + p.y * FR.ppu, R = RADIUS_U * FR.ppu, want = part === 'eye' ? REGION.eye : REGION.ear;
      let n = 0, sx = 0, sy = 0;
      for (let y = Math.max(0, Math.floor(ey - R)); y < Math.min(r.h, ey + R); y++) for (let x = Math.max(0, Math.floor(ex - R)); x < Math.min(r.w, ex + R); x++) if (r.regions[y * r.w + x] === want && Math.hypot(x - ex, y - ey) <= R) { n++; sx += x; sy += y; }
      out.push({ seed, yaw: v.yaw, pitch: v.pitch, part, side: sg, px: n, offsetU: n < MIN_PX ? null : Math.hypot(sx / n - ex, sy / n - ey) / FR.ppu });
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('measure-registration.ts')) {
  const args = process.argv.slice(2).map(Number), persp = args[0] || undefined, seeds = args.slice(1).length ? args.slice(1) : [3, 11, 42];
  const views: View[] = [];
  for (const pitch of [-60, -30, 0, 30, 60]) for (const yaw of [0, 35, 70]) views.push({ yaw, pitch, ...(persp ? { persp } : {}) });
  console.log(JSON.stringify(seeds.flatMap((s) => measure(variedHead(s).spec, s, views))));
}
