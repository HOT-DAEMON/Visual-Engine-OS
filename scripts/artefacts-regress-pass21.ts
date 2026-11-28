import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CASES } from '../src/regression/cases';
import { makeKit } from './lib/artefacts-kit';
import { REF_DIR, REF_H, REF_W, renderCase } from './lib/regress';

/** PASSE 21 — preuve du changement voulu des références visuelles : référence stockée (état d'avant) | rendu actuel, zone des yeux ×4. Sortie : artefacts/eyes-pass21/06-regress-avant-apres.png. */
const { sheet, cropPng } = makeKit('artefacts/eyes-pass21');
const ids = (process.argv[2] ?? 'std-03,std-07,std-15,hard-09-nez-projection-maximale').split(',');
const Y0 = 36, H = 46, S = 4;
const wrap = (png: Buffer): string => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${REF_W * S}" height="${REF_H * S}"><image xlink:href="data:image/png;base64,${png.toString('base64')}" width="${REF_W * S}" height="${REF_H * S}"/></svg>`;   // même chemin matriciel pour les deux images : comparaison à égalité de netteté
const cells: { img: Buffer; label: string }[] = [];
for (const id of ids) {
  const c = ALL_CASES.find((x) => x.id === id); if (!c) throw new Error(`cas inconnu : ${id}`);
  cells.push({ img: cropPng(wrap(readFileSync(join(REF_DIR, `${id}.png`))), 1, 0, Y0 * S, REF_W * S, H * S), label: `${id} — référence (avant)` });
  cells.push({ img: cropPng(wrap(cropPng(renderCase(c).svg, 1, 0, 0, REF_W, REF_H)), 1, 0, Y0 * S, REF_W * S, H * S), label: `${id} — actuel (après)` });
}
sheet('06-regress-avant-apres.png', cells, 680, 184, 2);
