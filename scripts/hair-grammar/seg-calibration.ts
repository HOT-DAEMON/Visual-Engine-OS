// Étalonnage de la segmentation par mèche sur la grammaire (passe 5) : statistiques de `segmentStrands` selon chaque axe d'intention. Voir docs/HAIR-PASS5-SEGMENT.md.
// Usage : npx tsx scripts/hair-grammar/seg-calibration.ts
import { generate } from '../../src/hair-grammar/grammar';
import { applyIntent } from '../../src/hair-grammar/intent';
import { segmentStrands } from '../../src/hair-grammar/observe-strands';
import { paintLock } from '../../src/hair-grammar/paint';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { headEllipse, referenceFromPainted } from '../../src/hair-grammar/reference-fit';
import { viewAt } from './engine-kit';
const V = viewAt(0); const E = headEllipse(TOUSLED, V); const W = 156, Hh = 150;
const f = (x: number) => x.toFixed(3);
for (const [axis, vals] of [['volume', [-1, 0, 1]], ['weight', [-1, 0, 1]], ['sleek', [0, 0.5, 1]], ['fringe', [-1, 0, 1]]] as const) {
  for (const v of vals) { const acc = { n: 0, w: 0, wcv: 0, l: 0, lcv: 0, cov: 0 }; const seeds = [1, 2, 3, 4, 5, 6];
    for (const s of seeds) { const P = applyIntent(TOUSLED, { [axis]: v }).profile; const pl = generate(P, s).map((L) => paintLock(P.head, L, V)); const S = segmentStrands(referenceFromPainted(pl, W, Hh), E);
      acc.n += S.count; acc.w += S.width.mean; acc.wcv += S.width.cv; acc.l += S.length.mean; acc.lcv += S.length.cv; acc.cov += S.coverage; }
    const k = seeds.length; console.log(axis.padEnd(7), String(v).padStart(4), 'count', (acc.n / k).toFixed(1).padStart(5), 'w', f(acc.w / k), 'wcv', f(acc.wcv / k), 'l', f(acc.l / k), 'lcv', f(acc.lcv / k), 'cov', f(acc.cov / k)); }
}
