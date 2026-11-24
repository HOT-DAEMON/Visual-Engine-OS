/**
 * CAPTURE CADRÉE (itération 07) : `npx tsx scripts/body-refs/zoom-shot.ts <archétype> <yaw> <x0,y0,w,h en hauteurs de tête depuis l'axe / la base du cou> <fichier.png> [largeur]`
 * Même chaîne de rendu que `junction-snap.ts` (volumes + rendu par pixel, densité constante) ; sert aux gros plans de preuve (acromion, aisselle, aine, omoplate).
 */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes, renderVolumes, renderVolumesPixel, type Camera } from '../../src/body/volume';
import { BG, bodyHost } from '../lib/body-host';

const [arch = 'veryMuscular', yawS = '0', boxS = '-1.4,-0.3,1.0,0.8', file = '/tmp/zoom.png', widthS = '1000'] = process.argv.slice(2);
const H = bodyHost(), box = boxS.split(',').map(Number) as [number, number, number, number], yaw = Number(yawS), h = H.a.h;
const cam: Camera = { yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, full = bodyVolumes((ARCHETYPES as Record<string, unknown>)[arch] as BodyInput, H.a, {});
// Diagnostic : KEEP=<regex> ne garde que les volumes dont l'identifiant correspond ; DROP=<regex> retire ceux qui correspondent ; SCALE (défaut 1) règle la densité de pixels.
const keep = process.env.KEEP ? new RegExp(process.env.KEEP) : null, drop = process.env.DROP ? new RegExp(process.env.DROP) : null, scale = Number(process.env.SCALE ?? 1);
const vs = full.volumes.filter((v) => (!keep || keep.test(v.id)) && (!drop || !drop.test(v.id))), set = { ...full, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) };
const vb0 = renderVolumes(set, { skin: H.skin, camera: cam, uid: 'zv' }).bounds;
const m = renderVolumesPixel(set, { skin: H.skin, heightPx: Math.round(0.62 * (vb0.y1 - vb0.y0) * Math.max(1, 1.6 / box[3]) * scale), camera: cam, uid: 'zs' }), b = m.bounds;
const vb = `${box[0] * h} ${H.a.baseY + box[1] * h} ${box[2] * h} ${box[3] * h}`;
writeFileSync(file, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${widthS}"><rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="${BG}"/>${m.svg}</svg>`).render().asPng());
console.log('ok', file);
