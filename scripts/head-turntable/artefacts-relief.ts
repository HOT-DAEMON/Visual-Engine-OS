import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { encodePngRgba } from '../../src/core/png';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { cheekRelief } from '../../src/head-turntable/engines/cheek-relief';
import { skullRelief } from '../../src/head-turntable/engines/skull-relief';

/**
 * Preuves visuelles des reliefs de la tête (bosses pariétales, asymétrie, joues, oreille lointaine, cou → épaules) :
 *   <out>/grille-<graine>/y<lacet>_p<tangage>.png : grille lacet × tangage d'une tête (à comparer à `references/rotation-3d/01.jpg`, grille 5 × 5 lacet × tangage) ;
 *   <out>/champs.json : les champs de relief (crâne, joue) échantillonnés (hauteur × azimut) pour la carte thermique.
 * Les composites sont assemblés par `compose-relief.py`. Usage : tsx artefacts-relief.ts <dossier> [graines, défaut 3,5,6] [hauteurPx, défaut 420]
 */
const out = process.argv[2] ?? '/tmp/relief', seeds = (process.argv[3] ?? '3,5,6').split(',').map(Number), H = Number(process.argv[4] ?? 420);
const YAWS = [90, 45, 0, -45, -90], PITCHES = [35, 18, 0, -18, -35];
mkdirSync(out, { recursive: true });
const fields: Record<string, unknown> = {};
for (const s of seeds) {
  const h = variedHead(s), d = join(out, `grille-seed${s}`); mkdirSync(d, { recursive: true });
  for (const yaw of YAWS) for (const pitch of PITCHES) { if (existsSync(join(d, `y${yaw}_p${pitch}.png`))) continue; const r = renderHead({ yaw, pitch }, h.spec, { frame: defaultFrame(H), ss: 2 }); writeFileSync(join(d, `y${yaw}_p${pitch}.png`), encodePngRgba(r.w, r.h, r.rgba)); }
  const e = h.spec.engine!, ys = Array.from({ length: 36 }, (_, i) => 0.05 + i * 0.0275), azs = Array.from({ length: 61 }, (_, i) => i * 3);
  fields[`seed${s}`] = { ys, azs, skull: ys.map((y) => azs.map((a) => +skullRelief(e, y, (a * Math.PI) / 180).toFixed(5))), cheek: ys.map((y) => azs.map((a) => +cheekRelief(e, y, (a * Math.PI) / 180).toFixed(5))) };
}
writeFileSync(join(out, 'champs.json'), JSON.stringify(fields));
console.log('ok', seeds.length, 'têtes,', YAWS.length * PITCHES.length, 'vues chacune');
