import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { alaSeat, alaSeated } from '../../src/head-turntable/parts';
import { ALA_CONTOUR_BOUNDS, ALA_TOL_45, ALA_TOL_60, ALA_TOL_70, alaOverflow, frontWidthRatio, type ContourBound } from '../../src/head-turntable/nose-contour';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Effet des bornes 45°/60°/70° avec le levier d'enfoncement (docs/NOSE-YAW-BOUNDS.md), 40 graines (500 + 37·k) × 4 types, calcul analytique (aucun rendu).
 * États : `avant` = commit f5d0ce2 (30° + 45° rappel ≤ 0,25, pas d'enfoncement, rien à 60°/70°) ; `defaut` = bornes actuelles ; `rappel_plein` = 30° + 45° rappel jusqu'à 0,6 (l'alternative de NOSE-YAW45.md §5).
 * Reproduire : `npx tsx scripts/nose-refs/yaw-bounds-stats.ts` → artefacts/nez-bornes-60-70/stats.json
 */
const N = 40, r = (x: number): number => +x.toFixed(4), q = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
const bounds = ALA_CONTOUR_BOUNDS as ContourBound[], DEF = bounds.map((b) => ({ ...b }));
const STATES: Record<string, ContourBound[]> = {
  avant: [DEF[0]!, { ...DEF[1]!, maxEmbed: 0 }],
  defaut: DEF,
  rappel_plein: [DEF[0]!, { ...DEF[1]!, maxEmbed: 0, maxPull: 0.6 }],
};
const TOL: Record<number, number> = { 45: ALA_TOL_45, 60: ALA_TOL_60, 70: ALA_TOL_70 };
const out: Record<string, unknown> = { tolerances: TOL, etats: Object.fromEntries(Object.entries(STATES).map(([k, v]) => [k, v.map((b) => ({ ...b }))])) };
for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
  const sp = Array.from({ length: N }, (_, k) => head3dSubject(hostOf(500 + k * 37, a), {} as never).spec) as HeadTurnSpec[], row: Record<string, unknown> = {};
  for (const [nom, st] of Object.entries(STATES)) {
    bounds.length = 0; bounds.push(...st);
    const seats = sp.map(alaSeat), arr = sp.map((s, i) => alaSeated(s, -1, seats[i]!.pull, seats[i]!.embed)), arr1 = sp.map((s, i) => alaSeated(s, 1, seats[i]!.pull, seats[i]!.embed));
    const ov = (yaw: number): number[] => sp.map((s, i) => alaOverflow(s, arr[i]!, yaw)), rel = seats.map((s, i) => s.pull / sp[i]!.nose.alaX), fw = sp.map((s, i) => frontWidthRatio(s, arr1[i]!));
    const stat = (yaw: number) => { const o = ov(yaw), t = TOL[yaw] ?? 0; return { max: r(Math.max(...o)), med: r(q(o, 0.5)), part_sup_tol: r(o.filter((x) => x > t + 1e-6).length / N) }; };
    row[nom] = { d30: stat(30), d45: stat(45), d60: stat(60), d70: stat(70),
      rappel: { part: r(rel.filter((x) => x > 1e-6).length / N), med: r(q(rel, 0.5)), max: r(Math.max(...rel)) },
      enfoncement: { part: r(seats.filter((s) => s.embed > 1e-6).length / N), med: r(q(seats.map((s) => s.embed), 0.5)), max: r(Math.max(...seats.map((s) => s.embed))), satures_a_1: seats.filter((s) => s.embed >= 1 - 1e-6).length },
      largeurFace: { min: r(Math.min(...fw)), max: r(Math.max(...fw)) } };
  }
  bounds.length = 0; bounds.push(...DEF);
  out[a ?? 'libre'] = row; console.log(String(a ?? 'libre').padEnd(13), JSON.stringify(row));
}
writeFileSync('artefacts/nez-bornes-60-70/stats.json', JSON.stringify(out, null, 1));
