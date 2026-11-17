import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { alaOf } from '../../src/head-turntable/parts';
import { engineHead } from '../../src/head-turntable/engines/face-model';
import { noseKnots, noseLandmarks } from '../../src/head-turntable/engines/nose-mouth';
import { fx, fy } from '../../src/head-turntable/engines/units';
import { engineSpec } from '../../src/head-turntable/engines/spec-engine';
import { REF_FIT } from '../../src/head-turntable/ref-fit';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * LARGEUR DU NEZ EN VUE DE FACE : silhouette 2D du moteur (celle que la planche 06 contraint) contre l'emprise frontale des pièces 3D (bosse centrale + 2 ellipsoïdes d'ailes), par calcul analytique.
 * La planche 06 ne donne PAS de largeur absolue : `extract_06.py` normalise par la boîte de chaque forme. Elle fixe (a) le profil de largeur normalisé et (b) le rapport L/H de la boîte. C'est (b) que l'on teste ici.
 * Reproduire : `npx tsx scripts/nose-refs/width-3d-vs-2d.ts` → artefacts/nez-largeur-3d/mesures.json
 */
const knotAt = (k: HeadTurnSpec['nose']['knots'], y: number): number => { if (y <= k[0]![0]) return k[0]![2]; for (let i = 0; i + 1 < k.length; i++) { const a = k[i]!, b = k[i + 1]!; if (y <= b[0]) return a[2] + (b[2] - a[2]) * ((y - a[0]) / (b[0] - a[0] || 1)); } return k[k.length - 1]![2]; };
export interface FrontWidth { w2d: number; w3d: number; h2d: number; h3d: number; lh2d: number; lh3d: number; ratio: number }
/** `shift` (U) décale le centre des ailes vers l'extérieur : `shift = ex` reconstruit l'ancien comportement (centre sur la crête) pour la comparaison avant/après. */
export function frontWidths(s: HeadTurnSpec, shift = 0): FrontWidth {
  const k = s.nose.knots, y0 = k[0]![0], y1 = k[k.length - 1]![0], a0 = alaOf(s, 1), a = { ...a0, c: { ...a0.c, x: a0.c.x + shift } };
  let m2 = 0, m3 = 0, lo3 = y0, hi3 = y1;
  const N = 400;
  for (let i = 0; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N, w = knotAt(k, y);
    const t = (y - a.c.y) / a.ey, wa = Math.abs(t) < 1 ? a.c.x + a.ex * Math.sqrt(1 - t * t) : 0;
    m2 = Math.max(m2, w); m3 = Math.max(m3, w, wa);
  }
  lo3 = Math.min(lo3, a.c.y - a.ey); hi3 = Math.max(hi3, a.c.y + a.ey);
  const h2d = y1 - y0, h3d = hi3 - lo3;
  return { w2d: 2 * m2, w3d: 2 * m3, h2d, h3d, lh2d: (2 * m2) / h2d, lh3d: (2 * m3) / h3d, ratio: m3 / m2 };
}
if (process.argv[1]?.endsWith('width-3d-vs-2d.ts')) {
  const out: Record<string, unknown> = {}, r = (x: number) => +x.toFixed(4);
  const e = engineHead(), nl = noseLandmarks(e), pl = engineSpec(undefined, (head3dSubject(hostOf(11), {} as never).spec));
  void REF_FIT; void fx; void fy; void noseKnots;
  const f0 = frontWidths(pl), fAv = frontWidths(pl, alaOf(pl, 1).ex); out.planche = { apres: f0, avant: fAv }; console.log('planche après', JSON.stringify(f0), 'avant', JSON.stringify(fAv), 'crestX', r(nl.crestX));
  for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
    const rows = [11, 77, 1203, 500, 537, 574].map((sd) => frontWidths(head3dSubject(hostOf(sd, a), {} as never).spec));
    const med = (f: (x: FrontWidth) => number) => [...rows.map(f)].sort((p, q) => p - q)[Math.floor(rows.length / 2)]!;
    out[a ?? 'libre'] = { ratioMed: r(med((x) => x.ratio)), lh2d: r(med((x) => x.lh2d)), lh3d: r(med((x) => x.lh3d)), rows };
    console.log((a ?? 'libre').padEnd(13), 'ratio L3D/L2D', r(med((x) => x.ratio)), ' L/H 2D', r(med((x) => x.lh2d)), ' L/H 3D', r(med((x) => x.lh3d)));
  }
  writeFileSync('artefacts/nez-largeur-3d/mesures.json', JSON.stringify(out, null, 1));
}
