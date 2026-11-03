/**
 * Instantanés des jambes pour le comparatif avant/après : `npx tsx scripts/body-refs/legs-snap.ts <dossier>`. Même cadrage, même densité de pixels dans les deux arbres
 * (itération 05 dans un worktree, itération 06 dans l'arbre courant) : seules les jambes diffèrent. Cadrage en fractions de la hauteur du rendu (y0–y1).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes, renderVolumesPixel, type Camera } from '../../src/body/volume';
import { BG, bodyHost } from '../lib/body-host';
import { rasterPng } from '../lib/raster';

const out = process.argv[2] ?? 'artefacts/upper-limb-06/apres', H = bodyHost(), W = 800;
mkdirSync(out, { recursive: true });
const cam = (yaw: number): Camera => ({ yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } });
const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
/** [nom, yaw, y0, y1, ratio largeur/hauteur] */
const SHOTS: readonly (readonly [string, number, number, number, number])[] = [
  ['jambes-face', 0, 0.4, 1, 0.9], ['jambes-trois-quarts', 40, 0.4, 1, 0.9], ['jambes-profil', 90, 0.4, 1, 0.9], ['jambes-dos', 180, 0.4, 1, 0.9],
  ['genou-face', 0, 0.58, 0.78, 1.15], ['genou-profil', 90, 0.58, 0.78, 1.15], ['pied-trois-quarts', 40, 0.9, 1, 1.9], ['pied-profil', 90, 0.9, 1, 1.9],
];
for (const [name, yaw, y0, y1, ratio] of SHOTS) {
  const r = renderVolumesPixel(set, { skin: H.skin, heightPx: 1800, camera: cam(yaw), uid: `ls${name}` }), b = r.bounds, hh = b.y1 - b.y0, top = b.y0 + y0 * hh, ph = (y1 - y0) * hh, pw = ph * ratio, cx = (b.x0 + b.x1) / 2, Hh = Math.round(W / ratio);
  writeFileSync(`${out}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx - pw / 2} ${top} ${pw} ${ph}" width="${W}" height="${Hh}"><rect x="${cx - pw / 2}" y="${top}" width="${pw}" height="${ph}" fill="${BG}"/>${r.svg}</svg>`, { fitWidth: W }));
}
console.log('instantanés →', out);
