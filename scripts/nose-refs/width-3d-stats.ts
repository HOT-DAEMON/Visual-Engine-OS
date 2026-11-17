import { readFileSync, writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { alaOf, alaPull } from '../../src/head-turntable/parts';
import { alaOverflow } from '../../src/head-turntable/nose-contour';
import { frontWidths } from './width-3d-vs-2d';

/**
 * Effet de l'ancrage du bord externe des ailes sur 40 graines (500 + 37·k) × 4 types de nez : largeur de face 3D / silhouette 2D (avant = centre sur la crête, reconstruit par décalage de `ex`),
 * rappel de contour à 30°, débordement à 30° et 45°. Reproduire : `npx tsx scripts/nose-refs/width-3d-stats.ts` → artefacts/nez-largeur-3d/stats.json
 */
const N = 40, q = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!, r = (x: number) => +x.toFixed(4);
const prev = JSON.parse(readFileSync('artefacts/nez-ailes-contour/stats.json', 'utf8')), out: Record<string, unknown> = {};
for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
  const sp = Array.from({ length: N }, (_, k) => head3dSubject(hostOf(500 + k * 37, a), {} as never).spec);
  const av = sp.map((s) => frontWidths(s, alaOf(s, 1).ex).ratio), ap = sp.map((s) => frontWidths(s).ratio);
  const pulls = sp.map(alaPull), o30 = sp.map((s) => alaOverflow(s, alaOf(s, -1), 30)), o45 = sp.map((s) => alaOverflow(s, alaOf(s, -1), 45));
  const key = a ?? 'libre', row = {
    ratioLargeur: { avant: { med: r(q(av, 0.5)), max: r(Math.max(...av)) }, apres: { med: r(q(ap, 0.5)), min: r(Math.min(...ap)), max: r(Math.max(...ap)) } },
    rappel30: { part: r(pulls.filter((x) => x > 1e-6).length / N), satures: pulls.filter((p, i) => p >= 0.6 * sp[i]!.nose.alaX - 1e-6).length },
    debordement: { '30': { max: r(Math.max(...o30)), part_sup_0_01: r(o30.filter((x) => x > 0.01).length / N) }, '45': { max: r(Math.max(...o45)), part_sup_0_01: r(o45.filter((x) => x > 0.01).length / N) } },
    avantRef: prev[key]?.rappel,
  };
  out[key] = row; console.log(key.padEnd(13), JSON.stringify(row));
}
writeFileSync('artefacts/nez-largeur-3d/stats.json', JSON.stringify(out, null, 1));
