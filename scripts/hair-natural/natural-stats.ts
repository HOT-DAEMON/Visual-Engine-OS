import { generateRandomFace } from '../../src';
import { faceLandmarks, hairGeometry } from '../../src/face';
import { bunMetrics, outlineDent } from '../../src/verify/hair-natural';
import { hairFaceSpec, type CleanStyle } from '../lib/hair-faces';
import { coverageOf } from '../../src/face/hair/sides';

/** Mesures du contrôle `hair-natural` sur 60 visages : `npx tsx scripts/hair-natural/natural-stats.ts` (distribution : médiane / p90 / max). */
const q = (a: number[], p: number): string => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]!.toFixed(3) : '-';
const row = (name: string, a: number[]): void => console.log(`${name.padEnd(22)} n=${a.length} med ${q(a, .5)} p90 ${q(a, .9)} min ${q(a, 0)} max ${q(a, 1)}`);
for (const st of ['afro', 'curly'] as CleanStyle[]) {
  const dent: number[] = [], gap: number[] = [];
  for (let k = 0; k < 60; k++) {
    const sp = hairFaceSpec(st, k + 1, { engine: 'v2', seed: 9000 + k * 71, identity: k % 8 });
    const f = generateRandomFace(sp.seed, sp.opts), lm = faceLandmarks(f.params, f.width, f.height), g = hairGeometry(f.params, lm);
    if (!g) continue;
    dent.push(outlineDent(g.base[0]!, lm.W));
    if (g.sides.left.ear === 'covered' && g.sides.right.ear === 'covered') gap.push(Math.abs(coverageOf(g.front, g.sides.left.earZone) - coverageOf(g.front, g.sides.right.earZone)));
  }
  row(`${st} dent`, dent); row(`${st} earGap`, gap);
}
const rad: number[] = [], vis: number[] = [];
for (let k = 0; k < 60; k++) {
  const sp = hairFaceSpec('bun', k + 1, { engine: 'v2', seed: 9000 + k * 71, identity: k % 8 });
  const f = generateRandomFace(sp.seed, sp.opts), lm = faceLandmarks(f.params, f.width, f.height), g = hairGeometry(f.params, lm);
  const m = g && bunMetrics(g, lm); if (m) { rad.push(m.radius); vis.push(m.visible); }
}
row('bun radius', rad); row('bun visible', vis);
