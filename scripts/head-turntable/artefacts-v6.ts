import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { encodePngRgba } from '../../src/core/png';
import { variedHead } from '../../src/head-turntable/engines/from-face';

/**
 * Preuves visuelles du cou en cloche (v6) : vues brutes d'une tête par graine, lacet × (0, 90, 180) au tangage de la planche.
 * Usage : tsx artefacts-v6.ts <dossier> [graines, défaut 3,5,6,11] [hauteurPx, défaut 520]. L'assemblage avant/après est fait par `compose-v6.py`.
 */
const out = process.argv[2] ?? '/tmp/v6', seeds = (process.argv[3] ?? '3,5,6,11').split(',').map(Number), H = Number(process.argv[4] ?? 520);
mkdirSync(out, { recursive: true });
for (const s of seeds) {
  const h = variedHead(s);
  for (const yaw of [0, 90, 180]) { const r = renderHead({ yaw, pitch: 17.73 }, h.spec, { frame: defaultFrame(H), ss: 2 }); writeFileSync(join(out, `s${s}_y${yaw}.png`), encodePngRgba(r.w, r.h, r.rgba)); }
}
console.log('ok', seeds.length, 'têtes');
