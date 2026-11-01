/**
 * INSTANTANÉS reproductibles pour comparer deux états du moteur (avant/après) : `npx tsx scripts/body-refs/snap.ts <dossier>`.
 * N'utilise que des API stables (profileFit, renderVolumesPixel) : il tourne tel quel sur un ancien commit (worktree) comme sur le code courant.
 * Écrit : profile-overlay.png (rouge = référence seule, bleu = moteur seul, gris = recouvrement), back-zoom.png (haut du dos, très musclé), metrics.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes, renderVolumesPixel, type Camera } from '../../src/body/volume';
import { BG, bodyHost } from '../lib/body-host';
import { readFileSync } from 'node:fs';
import { bodyFrame } from '../../src/body/frame';
import { BodyParams } from '../../src/body/types';
import { profileFit, profileMask } from './profile-iou';

const out = process.argv[2] ?? 'snap', W = 564, H = 771;
mkdirSync(out, { recursive: true });
const host = bodyHost(), ref = profileMask(), fit = profileFit(ARCHETYPES.adultMale as BodyInput, 90, host);
// Zone MESURÉE : de la base du cou à la crête iliaque du moteur (le moteur n'a ni jambes ni tête dans ce rendu : ces rangées sont estompées, pas comptées).
const meas = JSON.parse(readFileSync('references/anatomy/measures.json', 'utf8'))['ref-04'], y0 = Math.round(meas.neckBaseY), y1 = Math.min(Math.round(meas.hipY), Math.round(fit.oy + fit.s * bodyFrame(BodyParams.parse(ARCHETYPES.adultMale), host.a).y.crop) - 2);
const runs: string[] = [];
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const a = ref[y * W + x]!, b = fit.mask[y * W + x]!, dim = y < y0 || y > y1, c = a && b ? (dim ? '#555' : '#c9c9c9') : a ? (dim ? '#5a2a2a' : '#e23b3b') : b ? (dim ? '#2a3d5a' : '#3b78e2') : ''; let x2 = x + 1; while (x2 < W && ((ref[y * W + x2]! && fit.mask[y * W + x2]! ? (dim ? '#555' : '#c9c9c9') : ref[y * W + x2]! ? (dim ? '#5a2a2a' : '#e23b3b') : fit.mask[y * W + x2]! ? (dim ? '#2a3d5a' : '#3b78e2') : '') === c)) x2++; if (c) runs.push(`<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${c}"/>`); x = x2; } }
writeFileSync(`${out}/profile-overlay.png`, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" shape-rendering="crispEdges"><rect width="${W}" height="${H}" fill="#101010"/>${runs.join('')}<line x1="0" y1="${y0}" x2="${W}" y2="${y0}" stroke="#fff" stroke-width="1" stroke-dasharray="6 4"/><line x1="0" y1="${y1}" x2="${W}" y2="${y1}" stroke="#fff" stroke-width="1" stroke-dasharray="6 4"/></svg>`).render().asPng());
const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, host.a, {}), cam: Camera = { yaw: 180, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
const m = renderVolumesPixel(set, { skin: host.skin, heightPx: 1800, camera: cam, uid: 'sn' }), b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0;
writeFileSync(`${out}/back-zoom.png`, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0 + w * 0.12} ${b.y0} ${w * 0.76} ${h * 0.5}" width="1000"><rect x="${b.x0}" y="${b.y0}" width="${w}" height="${h}" fill="${BG}"/>${m.svg}</svg>`).render().asPng());
writeFileSync(`${out}/metrics.json`, JSON.stringify({ iou: +fit.iou.toFixed(4), rowErr: +fit.rowErr.toFixed(4) }));
console.log('snap →', out, `IoU ${fit.iou.toFixed(3)} err ${(fit.rowErr * 100).toFixed(1)} %`);
