import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { alaPull, alaSeated } from '../../src/head-turntable/parts';
import { ALA_CONTOUR_BOUNDS, ALA_PULL_MAX, ALA_TOL_45, alaOverflow, frontWidthRatio, type ContourBound } from '../../src/head-turntable/nose-contour';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Effet de la borne du 45° (docs/NOSE-YAW45.md) sur 40 graines (500 + 37·k) × 4 types de nez. « Avant » = contrainte à 30° seule (état du commit 637843a, reconstruit ici),
 * « après » = `alaPull` actuel (30° + 45° avec la tolérance de la planche). Reproduire : `npx tsx scripts/nose-refs/yaw45-stats.ts` → artefacts/nez-45deg/stats.json
 */
const N = 40, r = (x: number): number => +x.toFixed(4), q = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
const pull30 = (s: HeadTurnSpec): number => {   // état d'avant : seul le lacet 30°
  const max = (1 - ALA_PULL_MAX) * s.nose.alaX; let p = 0;
  for (let it = 0; it < 4; it++) { const ov = alaOverflow(s, alaSeated(s, -1, p), 30); if (ov <= 1e-5) break; p = Math.min(max, p + ov / Math.cos(Math.PI / 6) + 1e-4); }
  return p;
};
const out: Record<string, unknown> = { tolerance45: ALA_TOL_45, bornes: ALA_CONTOUR_BOUNDS.map((b) => ({ ...b })) };
const bounds = ALA_CONTOUR_BOUNDS as ContourBound[], DEFAULT45: ContourBound = { ...bounds[1]!, maxEmbed: 0 }, CAPS = { defaut_0_25: 0.25, plein_0_6: 0.6 } as const;   // DEFAULT45 = état du commit f5d0ce2 (sans enfoncement) : reproduit artefacts/nez-45deg/stats.json ; état actuel : docs/NOSE-YAW-BOUNDS.md
bounds.length = 2;
const stat = (sp: HeadTurnSpec[], pulls: number[]) => {
  const o = (yaw: number): number[] => sp.map((s, i) => alaOverflow(s, alaSeated(s, -1, pulls[i]!), yaw)), fw = sp.map((s, i) => frontWidthRatio(s, alaSeated(s, 1, pulls[i]!))), rel = pulls.map((p, i) => p / sp[i]!.nose.alaX);
  const o45 = o(45), sat = (cap: number): number => rel.filter((x) => x >= cap - 1e-6).length;
  return { rappel: { part: r(pulls.filter((x) => x > 1e-6).length / N), med: r(q(rel, 0.5)), max: r(Math.max(...rel)), satures_a_0_25: sat(0.25), satures_a_0_6: sat(0.6) },
    debordement45: { max: r(Math.max(...o45)), part_sup_tol: r(o45.filter((x) => x > ALA_TOL_45 + 1e-6).length / N) }, debordement30_max: r(Math.max(...o(30))), largeurFace: { min: r(Math.min(...fw)), max: r(Math.max(...fw)) } };
};
for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
  const sp = Array.from({ length: N }, (_, k) => head3dSubject(hostOf(500 + k * 37, a), {} as never).spec), row: Record<string, unknown> = { avant_30_seul: stat(sp, sp.map(pull30)) };
  for (const [nom, cap] of Object.entries(CAPS)) { bounds[1] = { ...DEFAULT45, maxPull: cap }; row[nom] = stat(sp, sp.map(alaPull)); }
  bounds[1] = DEFAULT45; out[a ?? 'libre'] = row; console.log(String(a ?? 'libre').padEnd(13), JSON.stringify(row));
}
writeFileSync('artefacts/nez-45deg/stats.json', JSON.stringify(out, null, 1));
