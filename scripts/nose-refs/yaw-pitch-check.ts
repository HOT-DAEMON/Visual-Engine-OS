import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { alaOf } from '../../src/head-turntable/parts';
import { alaOverflow } from '../../src/head-turntable/nose-contour';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * TANGAGE ≠ 0 : les bornes de contour sont calculées à tangage 0 (`alaOverflow`). Ici le débordement du nez (côté lointain) est MESURÉ PAR RENDU (différence nez / nez réduit à un fil, bande de rangées élargie de ±0,15 U car le nez monte et descend avec le tangage)
 * à 5 tangages, et comparé à la valeur calculée à tangage 0. Reproduire : `npx tsx scripts/nose-refs/yaw-pitch-check.ts [graines]` → artefacts/nez-bornes-60-70/pitch.json
 */
const bare = (s: HeadTurnSpec): HeadTurnSpec => ({ ...s, nose: { ...s.nose, knots: s.nose.knots.map(([y, z]) => [y, z, 0.0005] as const), alaX: 0.0001 } });
const ext = (r: ReturnType<typeof renderHead>, j: number): number => { for (let i = 0; i < r.w; i++) if (r.ids[j * r.w + i]) return i; return r.w; };
function far(spec: HeadTurnSpec, yaw: number, pitch: number): number {
  const frame = defaultFrame(300), a = renderHead({ yaw, pitch }, spec, { frame, ss: 1 }), b = renderHead({ yaw, pitch }, bare(spec), { frame, ss: 1 });
  const ys = spec.nose.knots.map((k) => k[0]), j0 = Math.round(a.originY + (Math.min(...ys) - 0.15) * a.ppu), j1 = Math.round(a.originY + (Math.max(...ys) + 0.15) * a.ppu);
  let m = 0; for (let j = Math.max(0, j0); j <= Math.min(a.h - 1, j1); j++) { const la = ext(a, j), lb = ext(b, j); if (la < a.w && lb < a.w) m = Math.max(m, lb - la); }
  return m / a.ppu;
}
const seeds = Number(process.argv[2] ?? 3), PITCH = [-30, -15, 0, 15, 30], YAW = [45, 60, 70], out: Record<string, unknown> = {};
for (const t of ['pyramide', 'cloche-ailes', 'plat-trapeze'] as const) for (const yaw of YAW) {
  const rows: number[][] = [], an: number[] = [];
  for (let k = 0; k < seeds; k++) { const s = head3dSubject(hostOf(500 + k * 37, t), {} as never).spec; an.push(alaOverflow(s, alaOf(s, -1), yaw)); rows.push(PITCH.map((p) => far(s, yaw, p))); }
  const ratio = PITCH.map((_, i) => rows.reduce((m, r) => Math.max(m, r[i]! - 0), 0));
  out[`${t}@${yaw}`] = { calcul_tangage0_max: +Math.max(...an).toFixed(4), rendu_max_par_tangage: Object.fromEntries(PITCH.map((p, i) => [p, +ratio[i]!.toFixed(4)])) };
  console.log(t, yaw, JSON.stringify(out[`${t}@${yaw}`]));
}
writeFileSync('artefacts/nez-bornes-60-70/pitch.json', JSON.stringify(out, null, 1));
