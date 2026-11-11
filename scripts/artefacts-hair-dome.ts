import { mkdirSync, writeFileSync } from 'node:fs';
import { layout, render } from './lib/proof';
import type { RandomFaceOptions } from '../src';

/**
 * Planche de DÉTAIL de la série « dôme, sous-couche et balayage du visage » (`docs/HAIR-DOME-ROUND.md`, `docs/HAIR-FIT-SIDE.md`, `docs/HAIR-FRINGE-CLUMPS.md`) :
 * les têtes entières qui posaient problème dans le corpus (graines 9000 + 71 k, `hairEngine: 'v2'`, coiffure forcée), grandes (échelle 1,15).
 *   npx tsx scripts/artefacts-hair-dome.ts <dossier> <étiquette>
 * Écrit `<dossier>/details-<étiquette>.png` avec LE CODE COURANT : à lancer dans un arbre « avant » (commit d'origine) et dans l'arbre « après » avec les MÊMES graines.
 * Ligne 1 : bob 9568 (bande à travers le visage), afros 9923 et 9284 (dôme carré, portée). Ligne 2 : afro 10491, short 9852 et spiky 9923 (frange).
 */
const BG = '#f4f1ea';
const CASES: readonly { style: string; seed: number }[] = [
  { style: 'bob', seed: 9568 }, { style: 'afro', seed: 9923 }, { style: 'afro', seed: 9284 },
  { style: 'afro', seed: 10491 }, { style: 'short', seed: 9852 }, { style: 'spiky', seed: 9923 },
];
const [dir = 'artefacts/hair-dome', tag = 'apres'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const C = 3, CW = 600, CH = 760;
const heads = layout(CASES.length, C, CW, CH, 1.15, (i) => ({ seed: CASES[i]!.seed, opts: { hair: { style: CASES[i]!.style }, hairEngine: 'v2' } as unknown as RandomFaceOptions }));
const file = `${dir}/details-${tag}.png`;
writeFileSync(file, render(heads.objects, C * CW, 2 * CH, '', BG));
console.log(file);
