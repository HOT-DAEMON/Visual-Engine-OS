/**
 * MESURE DE PROFIL PAR BANDE : bord arrière (dos) et bord avant (poitrine/ventre) du moteur comparés à ceux de `ref-04`, en unités de HAUTEUR DE TÊTE.
 * Le décalage horizontal est celui de `profileFit` (recalage en translation qui maximise l'IoU) : les écarts se lisent donc RELATIVEMENT à la colonne de
 * la figure, pas dans l'absolu. Signe : `dos` > 0 = le moteur déborde plus en arrière que la référence ; `avant` > 0 = le moteur déborde plus en avant.
 * Sortie : tableau + objet JSON réutilisé par les artefacts et la vérification.
 */
import { readFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyFrame } from '../../src/body/frame';
import { BodyParams } from '../../src/body/types';
import { bodyHost } from '../lib/body-host';
import { profileFit, profileMask } from './profile-iou';

const W = 564, meas = JSON.parse(readFileSync('references/anatomy/measures.json', 'utf8'))['ref-04'];
export interface Band { readonly t: number; readonly dos: number; readonly avant: number; readonly profRef: number; readonly profMot: number }
export function profileBands(arch: BodyInput = ARCHETYPES.adultMale as BodyInput, yaw: 90 | -90 = 90, n = 8): { bands: Band[]; iou: number; rowErr: number } {
  const host = bodyHost(), ref = profileMask(), fit = profileFit(arch, yaw, host), hh = meas.head.height as number;
  // Le tronc du moteur s'arrête à la crête iliaque (`y.crop`) : plus bas, le masque du moteur n'est que bras/mains → on s'arrête 2 px avant (sinon l'écart est un artefact).
  const crop = bodyFrame(BodyParams.parse(arch), host.a).y.crop, yEnd = Math.round(fit.oy + fit.s * crop) - 2;
  const y0 = Math.round(meas.neckBaseY), y1 = Math.min(Math.round(meas.hipY), yEnd), edges = (m: Uint8Array, y: number): [number, number] => { let a = W, b = -1; for (let x = 0; x < W; x++) if (m[y * W + x]) { a = Math.min(a, x); b = Math.max(b, x); } return [a, b]; };
  const bands: Band[] = [];
  for (let i = 0; i < n; i++) {
    const ya = y0 + Math.round(((y1 - y0) * i) / n), yb = y0 + Math.round(((y1 - y0) * (i + 1)) / n); let d = 0, a = 0, pr = 0, pm = 0, c = 0;
    for (let y = ya; y < yb; y++) { const [r0, r1] = edges(ref, y), [e0, e1] = edges(fit.mask, y); if (r1 < 0 || e1 < 0) continue; d += r0 - e0; a += e1 - r1; pr += r1 - r0; pm += e1 - e0; c++; }
    if (c) bands.push({ t: (i + 0.5) / n, dos: d / c / hh, avant: a / c / hh, profRef: pr / c / hh, profMot: pm / c / hh });
  }
  return { bands, iou: fit.iou, rowErr: fit.rowErr };
}
if (process.argv[1]?.endsWith('profile-edges.ts')) {
  const r = profileBands();
  console.log(`IoU ${r.iou.toFixed(3)}  erreur de profondeur ${(r.rowErr * 100).toFixed(1)} %   (unités : hauteur de tête)`);
  console.log('bande(cou→crête)  dos(+=moteur plus en arrière)  avant(+=moteur plus en avant)  profondeur réf  profondeur moteur');
  for (const b of r.bands) console.log(b.t.toFixed(2).padStart(8), b.dos.toFixed(2).padStart(14), b.avant.toFixed(2).padStart(26), b.profRef.toFixed(2).padStart(18), b.profMot.toFixed(2).padStart(16));
}
