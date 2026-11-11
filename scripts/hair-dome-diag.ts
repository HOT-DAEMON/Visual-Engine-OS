import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { shellCoverage } from '../src/face/hair/crown-fill';
import type { Poly } from '../src/face/poly';

/**
 * Diagnostic du dôme des volumes (afro, bouclé) : asymétrie gauche/droite de la coque et du bord nu.
 *   npx tsx scripts/hair-dome-diag.ts [style] [n]
 * Sortie : médiane / p90 / max de
 *   - `lop`   : |maxX droit − maxX gauche| / (somme) de la coque (0 = dôme centré) ;
 *   - `topOff`: décalage horizontal du sommet de la coque / W ;
 *   - `bareL`, `bareR` : part nue de la coque, moitié gauche / moitié droite ;
 *   - `bareGap`: |bareL − bareR|.
 */
const style = process.argv[2] ?? 'afro';
const N = Number(process.argv[3] ?? 40);
const seeds = Array.from({ length: N }, (_, i) => 9000 + i * 71);
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] as number;
const row = (name: string, a: number[]): string => `${name.padEnd(8)} med ${q(a, 0.5).toFixed(3)}  p90 ${q(a, 0.9).toFixed(3)}  max ${Math.max(...a).toFixed(3)}`;

const lop: number[] = [], topOff: number[] = [], bareL: number[] = [], bareR: number[] = [], gap: number[] = [];
for (const sd of seeds) {
  const f = generateRandomFace(sd, { hair: { style } as never, hairEngine: 'v2' });
  const lm = faceLandmarks(f.params, f.width, f.height);
  const g = hairGeometry(f.params, lm);
  if (!g) continue;
  const base = g.base[0] as Poly;
  let mxR = 0, mxL = 0, topY = Infinity, topX = 0;
  for (const v of base) {
    if (v.x > 0) mxR = Math.max(mxR, v.x); else mxL = Math.max(mxL, -v.x);
    if (v.y < topY) { topY = v.y; topX = v.x; }
  }
  lop.push(Math.abs(mxR - mxL) / (mxR + mxL));
  topOff.push(Math.abs(topX) / lm.W);
  const polys = g.locks.filter((l) => l.layer === 'front' && l.rank !== 'hairline').map((l) => l.poly);
  const half = (sgn: 1 | -1): number => {
    const clip = (p: Poly): Poly => p.map((v) => ({ x: sgn * Math.max(0, sgn * v.x), y: v.y }));
    return shellCoverage(g.boundary.skull, clip(base), lm.W, polys.map(clip)).all;
  };
  const l = half(-1), r = half(1);
  bareL.push(l); bareR.push(r); gap.push(Math.abs(l - r));
}
console.log(`${style} (${lop.length} visages)`);
for (const [n, a] of [['lop', lop], ['topOff', topOff], ['bareL', bareL], ['bareR', bareR], ['bareGap', gap]] as const) console.log(row(n, a as number[]));
