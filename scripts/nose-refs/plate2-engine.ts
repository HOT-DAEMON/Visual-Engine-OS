import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { REF_SPEC } from '../../src/head-turntable/spec';
import type { HeadTurnSpec } from '../../src/head-turntable';

/** Même estimateur que `plate2-profile.py`, côté moteur : têtes RASÉES de profil (lacet 90°, tangage 0), contour = premier pixel occupé de chaque rangée, pointe = minimum de x dans la fenêtre du nez, saillie à la corde ± δ·H (H = 1 U).
 * Usage : `npx tsx scripts/nose-refs/plate2-engine.ts` → artefacts/nez-bornes-60-70/plate2-profile.json */
const frame = defaultFrame(420), r4 = (x: number): number => +x.toFixed(4);
function saillie(spec: HeadTurnSpec, delta: number): number {
  const { hairVolume: _h, ...bald } = spec as HeadTurnSpec & { hairVolume?: unknown };
  const r = renderHead({ yaw: 90, pitch: 0 }, bald as HeadTurnSpec, { frame, ss: 1 }), L = new Map<number, number>();
  for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) if (r.ids[j * r.w + i]) { L.set(j, i); break; }
  const ys = spec.nose.knots.map((k) => k[0]), j0 = Math.round(r.originY + Math.min(...ys) * r.ppu), j1 = Math.round(r.originY + Math.max(...ys) * r.ppu);
  let tip = j0; for (let j = j0; j <= j1; j++) if ((L.get(j) ?? 1e9) < (L.get(tip) ?? 1e9)) tip = j;
  const a = Math.round(tip - delta * r.ppu), b = Math.round(tip + delta * r.ppu), la = L.get(a), lb = L.get(b), lt = L.get(tip);
  if (la === undefined || lb === undefined || lt === undefined) return NaN;
  return (la + ((lb - la) * (tip - a)) / (b - a) - lt) / r.ppu;
}
const out: Record<string, unknown> = { plancheRef: { REF_SPEC: [0.06, 0.09, 0.12].map((d) => r4(saillie(REF_SPEC, d))) } };
for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
  const v = Array.from({ length: 10 }, (_, k) => saillie(head3dSubject(hostOf(500 + k * 37, a), {} as never).spec, 0.09)).filter(Number.isFinite).sort((x, y) => x - y);
  out[a ?? 'libre'] = { n: v.length, min: r4(v[0]!), med: r4(v[Math.floor(v.length / 2)]!), max: r4(v[v.length - 1]!) };
}
console.log(JSON.stringify(out)); writeFileSync('artefacts/nez-bornes-60-70/plate2-profile.json', JSON.stringify(out, null, 1));
