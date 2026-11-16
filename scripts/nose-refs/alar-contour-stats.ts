import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { alaOf, alaPull } from '../../src/head-turntable/parts';
import { alaOverflow } from '../../src/head-turntable/nose-contour';
import { sectionAt } from '../../src/head-turntable/sections';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Débordement de l'aile lointaine (U, analytique) AVANT (formule d'origine : centre posé sur l'avant de l'axe `zf`) et APRÈS (pose sur la joue + contrainte), 40 graines (500 + 37·k) × 4 types de nez, lacets 30° et 45°.
 * Reproduire : `npx tsx scripts/nose-refs/alar-contour-stats.ts` → artefacts/nez-ailes-contour/stats.json
 */
const legacy = (s: HeadTurnSpec) => { const a = alaOf(s, -1), ka = s.engine ? s.nose.alaX / 0.0517 : 1, sa = sectionAt(s, a.c.y); return { ...a, c: { x: -s.nose.alaX, y: a.c.y, z: sa.zf + 0.022 * ka } }; };
const q = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
const N = 40, out: Record<string, unknown> = {};
for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
  const sp = Array.from({ length: N }, (_, k) => head3dSubject(hostOf(500 + k * 37, a), {} as never).spec), row: Record<string, unknown> = {};
  for (const yaw of [30, 45]) for (const [name, f] of [['avant', (s: HeadTurnSpec) => alaOverflow(s, legacy(s), yaw)], ['apres', (s: HeadTurnSpec) => alaOverflow(s, alaOf(s, -1), yaw)]] as const) {
    const v = sp.map(f); row[`${name}_${yaw}`] = { max: +Math.max(...v).toFixed(4), p90: +q(v, 0.9).toFixed(4), partSup0_01: +(v.filter((x) => x > 0.01).length / N).toFixed(3) };
  }
  const pulls = sp.map(alaPull); row.rappel = { part: +(pulls.filter((x) => x > 1e-6).length / N).toFixed(3), max: +Math.max(...pulls).toFixed(4), satures: pulls.filter((p, i) => p >= 0.6 * sp[i]!.nose.alaX - 1e-6).length };
  out[a ?? 'libre'] = row; console.log(a ?? 'libre', JSON.stringify(row));
}
writeFileSync('artefacts/nez-ailes-contour/stats.json', JSON.stringify(out, null, 1));
