/** DIAGNOSTIC : quel volume porte le contour supérieur de l'épaule à chaque abscisse (en unités de tête, côté gauche de l'image). */
import { Resvg } from '@resvg/resvg-js';
import { bodyVolumes, renderVolumes, type Camera } from '../../src/body/volume';
import { ARCHETYPES } from '../../src/body';
import { bodyHost } from '../lib/body-host';
import { fitToRef, loadRef } from './iou';
const CAM: Camera = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
const rn = (process.argv[2] ?? 'ref-02') as 'ref-02' | 'ref-04', H = bodyHost(), ref = loadRef(rn), body = (ARCHETYPES as any)[process.argv[3] ?? 'veryMuscular'];
const fit = fitToRef(ref, body, H.a, H.skin), set = bodyVolumes(body, H.a, {}), head = ref.meas.head.height as number, cx = ref.meas.centerX as number;
const cols = [0.5, 0.64, 0.79, 0.94, 1.08, 1.16, 1.23, 1.3].map((u) => Math.round(cx - u * head));
const best: { y: number; id: string }[] = cols.map(() => ({ y: 1e9, id: '-' }));
for (const v of set.volumes) {
  if (v.group === 'joint' || v.strand) continue;
  const one = { ...set, volumes: [v], byId: new Map([[v.id, v]]) };
  const m = renderVolumes(one as any, { skin: H.skin, camera: CAM, uid: 'w', level: 3, forceTier: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ref.w}" height="${ref.h}"><g transform="translate(${fit.ox} ${fit.oy}) scale(${fit.s})">${m.svg}</g></svg>`;
  const px = new Resvg(svg).render().pixels;
  cols.forEach((x, i) => { for (let y = Math.round(ref.meas.neckBaseY - 20); y < ref.meas.neckBaseY + 1.6 * head; y++) if (px[(y * ref.w + x) * 4 + 3]! > 40) { if (y < best[i]!.y) best[i] = { y, id: v.id }; break; } });
}
cols.forEach((x, i) => { let ty = -1; for (let y = Math.round(ref.meas.neckBaseY - 20); y < ref.meas.neckBaseY + 1.6 * head; y++) if (ref.m[y * ref.w + x]) { ty = y; break; } console.log(((cx - x) / head).toFixed(2), 'réf y=', ((ty - ref.meas.neckBaseY) / head).toFixed(3), ' moteur y=', ((best[i]!.y - ref.meas.neckBaseY) / head).toFixed(3), best[i]!.id); });
