import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { alaSeated, ALA_EX } from '../../src/head-turntable/parts';
import { alaOverflow, type AlaEllipsoid } from '../../src/head-turntable/nose-contour';
import { REF_SPEC } from '../../src/head-turntable/spec';
import type { HeadTurnSpec } from '../../src/head-turntable';

/** Étude des LEVIERS (aucun rendu) pour borner le débordement à 45° sans effacer les ailes de face. Reproduire : `npx tsx scripts/nose-refs/yaw45-levers.ts`. */
const N = 40;
const variant = (s: HeadTurnSpec, pull: number, embed: number, zShrink: number): AlaEllipsoid => {
  const a = alaSeated(s, -1, pull), ka = a.ex / ALA_EX;
  return { c: { ...a.c, z: a.c.z - embed * 0.022 * ka }, ex: a.ex, ey: a.ey, ez: a.ez * zShrink };
};
/** Part de l'aile qui dépasse la bosse centrale de FACE (U) : demi-largeur max de l'aile − demi-largeur de la bosse à la hauteur où l'aile est la plus large. */
const wingVisible = (s: HeadTurnSpec, a: AlaEllipsoid): number => {
  const k = s.nose.knots, half = (y: number): number => { for (let i = 0; i + 1 < k.length; i++) { const p = k[i]!, q = k[i + 1]!; if (y <= q[0]) return p[2] + (q[2] - p[2]) * ((y - p[0]) / (q[0] - p[0] || 1)); } return k[k.length - 1]![2]; };
  return Math.max(0, Math.abs(a.c.x) + a.ex - half(a.c.y));
};
const q = (xs: number[], p: number): number => [...xs].sort((u, v) => u - v)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
const rows: Array<[string, number, number, number]> = [['rappel 0', 0, 0, 1], ['rappel 0,25', 0.25, 0, 1], ['rappel 0,6', 0.6, 0, 1], ['enfoncer 50 %', 0, 0.5, 1], ['enfoncer 100 %', 0, 1, 1], ['ez ×0,6', 0, 0, 0.6], ['0,25 + enfoncer 50 % + ez ×0,7', 0.25, 0.5, 0.7]];
const ref = alaSeated(REF_SPEC, -1, 0);
console.log('REF_SPEC aile visible de face (U):', wingVisible(REF_SPEC, ref).toFixed(4));
for (const a of ['plat-trapeze', 'pyramide', 'cloche-ailes', undefined] as const) {
  const sp = Array.from({ length: N }, (_, k) => head3dSubject(hostOf(500 + k * 37, a), {} as never).spec);
  console.log('\n', a ?? 'libre', ': max débordement 45° | 60° | médiane aile visible de face (U)');
  for (const [nom, pull, emb, zs] of rows) {
    const o45 = sp.map((s) => alaOverflow(s, variant(s, pull * s.nose.alaX, emb, zs), 45)), o60 = sp.map((s) => alaOverflow(s, variant(s, pull * s.nose.alaX, emb, zs), 60)), vis = sp.map((s) => wingVisible(s, variant(s, pull * s.nose.alaX, emb, zs)));
    console.log(nom.padEnd(34), Math.max(...o45).toFixed(3), '|', Math.max(...o60).toFixed(3), '|', q(vis, 0.5).toFixed(4), ' part>tol45:', (o45.filter((x) => x > 0.0067).length / N).toFixed(2));
  }
}
