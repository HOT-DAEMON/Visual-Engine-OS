import { writeFileSync } from 'node:fs';
import { generateRandomFace } from '../../src';
import { faceLandmarks } from '../../src/face';
import { hairGeometry } from '../../src/face/hair';
import { TUCK } from '../../src/face/hair/tuck';
import { roundMetrics } from '../../src/verify/hair-round';

/**
 * Pourquoi la règle de cheveux `round-dome-centered` (`lop`) dépend-elle du nez ? (`docs/NOSE-DOME-COUPLING.md`)
 * Balayage de `nose.length` sur un même visage (graine 174218, afro), avec et sans le rentrage de la sous-couche (`tuck.ts`).
 *   npx tsx scripts/nose-refs/dome-lop-coupling.ts
 * NB : `hairGeometry` est mémoïsée par contenu et `clearCaches()` ne vide pas ce cache : la clé est cassée par un epsilon sur `nose.width`.
 */
export const LENS = [0.15, 0.16, 0.17, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25];
let eps = 0;
export function lopAt(seed: number, len: number): { lop: number; locks: number } {
  const F: any = generateRandomFace(seed);
  const p = structuredClone(F.params); p.nose.length = len; p.nose.width += ++eps * 1e-12;
  const lm: any = faceLandmarks(p, F.width, F.height);
  const g: any = hairGeometry(p, lm);
  return { lop: roundMetrics(g, lm).lop, locks: g.locks.filter((l: any) => l.layer === 'front').length };
}
export function sweep(seed: number): { len: number; withTuck: number; noTuck: number; locksWith: number }[] {
  const a = LENS.map((l) => lopAt(seed, l));
  const saved = { ...TUCK }; delete (TUCK as any).afro;
  const b = LENS.map((l) => lopAt(seed, l));
  Object.assign(TUCK, saved);
  return LENS.map((len, i) => ({ len, withTuck: a[i]!.lop, noTuck: b[i]!.lop, locksWith: a[i]!.locks }));
}
if (process.argv[1]?.endsWith('dome-lop-coupling.ts')) {
  const rows = sweep(174218);
  writeFileSync('artefacts/nez-dome-couplage/balayage-longueur.json', JSON.stringify(rows, null, 1));
  console.table(rows.map((r) => ({ ...r, withTuck: +r.withTuck.toFixed(4), noTuck: +r.noTuck.toFixed(4) })));
}
