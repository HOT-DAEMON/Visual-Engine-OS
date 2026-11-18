import { writeFileSync } from 'node:fs';
/** Attribution du débordement à tangage ≠ 0 (docs/NOSE-YAW-BOUNDS.md §5) : nez entier (vs fil) et ailes seules (vs nez sans ailes), par rendu, rangées non bornées. Usage : `npx tsx scripts/nose-refs/yaw-pitch-attrib.ts` → artefacts/nez-bornes-60-70/pitch-attrib.json */
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { defaultFrame, renderHead } from '../../src/head-turntable';
const bare = (s: any, keepCenter: boolean) => ({ ...s, nose: { ...s.nose, knots: keepCenter ? s.nose.knots : s.nose.knots.map(([y, z]: any) => [y, z, 0.0005]), alaX: keepCenter ? 0.0001 : 0.0001 } });
const ext = (r: any, j: number) => { for (let i = 0; i < r.w; i++) if (r.ids[j * r.w + i]) return i; return r.w; };
function far(spec: any, ref: any, yaw: number, pitch: number) {
  const frame = defaultFrame(300), a = renderHead({ yaw, pitch }, spec, { frame, ss: 1 }), b = renderHead({ yaw, pitch }, ref, { frame, ss: 1 });
  let m = 0; for (let j = 0; j < a.h; j++) { const la = ext(a, j), lb = ext(b, j); if (la < a.w && lb < a.w) m = Math.max(m, lb - la); } return m / a.ppu; }
const res: unknown[] = [];
for (const [seed, t] of [[500, 'pyramide'], [537, 'plat-trapeze']] as const) { const s: any = head3dSubject(hostOf(seed, t), {} as never).spec;
  for (const [yaw, p] of [[70, 0], [70, -30], [70, 30], [60, -30]] as const) {
    const total = far(s, bare(s, false), yaw, p), bumpOnly = far(s, bare(s, true), yaw, p);   // total = nez entier vs fil ; bumpOnly = ailes seules (bosse centrale gardée dans la référence)
    res.push({ type: t, seed, yaw, tangage: p, nez_entier: +total.toFixed(4), ailes_seules: +bumpOnly.toFixed(4) }); console.log(t, yaw, p, 'nez entier', total.toFixed(4), '| ailes seules', bumpOnly.toFixed(4)); } }
writeFileSync('artefacts/nez-bornes-60-70/pitch-attrib.json', JSON.stringify(res, null, 1));
