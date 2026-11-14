import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_CASES } from '../src/regression/cases';
import { faceLandmarks, noseGeometry, noseArchetype } from '../src/face';
import { FaceParams } from '../src/schema';
import { lightModelOf, litUnderview } from '../src/relief';
import { cellSvg } from './lib/board';
import { rasterPng } from './lib/raster';
/**
 * Rendus pour la planche avant/après de la loi de placement des narines (docs/NOSE-NOSTRIL-PLACEMENT.md) : npx tsx scripts/artefacts-nose-placement.ts <dossier>
 * À exécuter DEUX fois (sur le commit précédent via `git worktree`, puis sur l'arbre courant) ; la planche est composée par scripts/compose-nose-placement.py.
 * Rendu des cas de régression à 2× leur taille de référence (même graine, même cadrage : seul le moteur change) + dessous éclairé de 3 nez à 40°.
 */
const out = process.argv[2] ?? 'artefacts/nez-placement/render';
mkdirSync(out, { recursive: true });
const IDS = ['std-03', 'std-07', 'std-11', 'std-15', 'hard-09-nez-projection-maximale', 'hard-10-nez-minimal', 'hard-05-encre-contours-maximaux'];
for (const id of IDS) {
  const c = ALL_CASES.find((k) => k.id === id); if (!c) throw new Error(`cas inconnu : ${id}`);
  const { svg } = cellSvg({ seed: c.seed, opts: c.opts, patch: c.patch, light: c.light, focus: c.focus }, 340, 420);
  writeFileSync(`${out}/${id}.png`, rasterPng(svg));
}
const model = lightModelOf({ azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, { style: 'soft' });
for (const [lab, patch] of [['defaut', {}], ['pyramide', noseArchetype('pyramide' as never)], ['cloche-ailes', noseArchetype('cloche-ailes' as never)]] as const) {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }), nose = noseGeometry(p, faceLandmarks(p, 300, 380));
  writeFileSync(`${out}/dessous-${lab}-40.png`, litUnderview(nose, { pitchDeg: 40 }, '#c68e63', model, { shadow: p.skin.light.shadow }).png);
}
console.log('rendus écrits dans', out);
