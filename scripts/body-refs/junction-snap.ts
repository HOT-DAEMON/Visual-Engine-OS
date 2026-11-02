/**
 * CAPTURES DES RACCORDS : `npx tsx scripts/body-refs/junction-snap.ts <dossier>` — n'utilise que des API stables (volumes + rendu par pixel), donc exécutable à
 * l'identique sur un worktree d'une itération antérieure pour produire les images AVANT. Sorties : épaule gauche de face (très musclé), haut du corps en
 * trois-quarts (adulte), taches de fond sur le ventre (adulte, face), hanche de face et de dos (adulte, bas du tronc + haut des cuisses).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes, renderVolumes, renderVolumesPixel, type Camera } from '../../src/body/volume';
import { BG, bodyHost } from '../lib/body-host';

const out = process.argv[2] ?? 'artefacts/upper-limb-05/apres', H = bodyHost();
mkdirSync(out, { recursive: true });
/** Cadres en UNITÉS HÔTE absolues (x depuis l'axe, y depuis la base du cou, en hauteurs de tête) et densité de pixels constante : « avant » et « après » sont comparables même si le corps s'est allongé (jambes). */
const shot = (arch: string, yaw: number, box: readonly [number, number, number, number], file: string, width: number): void => {
  const cam: Camera = { yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, set = bodyVolumes((ARCHETYPES as Record<string, unknown>)[arch] as BodyInput, H.a, {}), vb0 = renderVolumes(set, { skin: H.skin, camera: cam, uid: `${file}v` }).bounds;
  const m = renderVolumesPixel(set, { skin: H.skin, heightPx: Math.round(0.62 * (vb0.y1 - vb0.y0)), camera: cam, uid: file }), b = m.bounds, h = H.a.h;
  const vb = `${box[0] * h} ${H.a.baseY + box[1] * h} ${box[2] * h} ${box[3] * h}`;
  writeFileSync(`${out}/${file}.png`, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${width}"><rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="${BG}"/>${m.svg}</svg>`).render().asPng());
};
shot('veryMuscular', 0, [-1.7, -0.45, 1.7, 1.6], 'epaule-face', 1000);
shot('adultMale', 40, [-1.7, -0.6, 3.4, 3.0], 'haut-trois-quarts', 1000);
shot('adultMale', 0, [-1.7, -0.6, 3.4, 3.0], 'ventre-face', 1000);
shot('adultMale', 0, [-1.7, 1.5, 3.4, 1.4], 'hanche-face', 1100);
shot('adultMale', 180, [-1.7, 1.5, 3.4, 1.4], 'hanche-dos', 1100);
console.log('ok →', out);
