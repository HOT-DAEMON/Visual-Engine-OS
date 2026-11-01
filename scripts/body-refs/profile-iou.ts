/**
 * COMPARAISON DE PROFIL à `ref-04` (figure de profil, masque `ref-04.profile.silhouette.gz`) : le moteur est rendu en vue de profil (caméra yaw ±90),
 * mis à l'échelle de la référence, et comparé par IoU sur y ∈ [base du cou, crête iliaque]. Conventions (assumées, non mesurées sur la référence) :
 *  - échelle = celle de la figure de face × (hauteur de figure profil / hauteur de figure face) ;
 *  - alignement vertical : sommet du crâne ; alignement horizontal : centroïde du masque du tronc (sinon l'avant/arrière serait décalé arbitrairement).
 * Les deux sens (yaw +90 et −90) sont essayés : celui qui colle le mieux dit dans quel sens la figure regarde.
 */
import { Resvg } from '@resvg/resvg-js';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { bodyVolumes, renderVolumes, type Camera } from '../../src/body/volume';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyHost } from '../lib/body-host';

const W = 564, H = 771;
const bits = gunzipSync(readFileSync('references/anatomy/ref-04.profile.silhouette.gz'));
export const profileMask = (): Uint8Array => { const m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = (bits[i >> 3]! >> (7 - (i & 7))) & 1; return m; };
const meas = JSON.parse(readFileSync('references/anatomy/measures.json', 'utf8'))['ref-04'];

export interface ProfFit { readonly rowErr: number; readonly iou: number; readonly mask: Uint8Array; readonly rgba: Uint8Array; readonly dx: number; readonly s: number; readonly oy: number }
export function profileFit(arch: BodyInput, yaw: 90 | -90, host = bodyHost(), shiftX = 0): ProfFit {
  const ref = profileMask(), set = bodyVolumes(arch, host.a, {});
  const cam: Camera = { yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
  const m = renderVolumes(set, { skin: host.skin, camera: cam, uid: 'pf' });
  const s = (meas.head.height / host.a.h) * (754 / 747), topRef = 8;
  const oy = topRef + 7 * 0 - 0; // placé plus bas : on aligne le sommet du crâne ci-dessous
  const oy2 = meas.neckBaseY + (topRef - meas.head.top) - host.a.baseY * s; void oy;
  // centroïde du tronc de la référence (y ∈ [neckBase, hipY]) pour l'alignement horizontal
  let rx = 0, rn = 0; for (let y = meas.neckBaseY; y <= meas.hipY; y++) for (let x = 0; x < W; x++) if (ref[y * W + x]) { rx += x; rn++; }
  const render = (ox: number): { mask: Uint8Array; rgba: Uint8Array } => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g transform="translate(${ox} ${oy2}) scale(${s})">${m.svg}</g></svg>`;
    const px = new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels, mask = new Uint8Array(W * H);
    for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3]! > 40 ? 1 : 0;
    return { mask, rgba: new Uint8Array(px) };
  };
  let r0 = render(0), ex = 0, en = 0; for (let y = meas.neckBaseY; y <= meas.hipY; y++) for (let x = 0; x < W; x++) if (r0.mask[y * W + x]) { ex += x; en++; }
  // Recalage en TRANSLATION seule : on part du centroïde, puis on cherche (±24 px, pas de 1) le décalage qui maximise l'IoU. C'est un recalage de silhouettes standard :
  // il ne corrige ni l'échelle ni la forme, donc l'IoU reste une mesure de forme. Il évite qu'un décalage avant/arrière arbitraire soit pris pour une erreur de profondeur.
  const dx0 = rx / rn - ex / Math.max(1, en) + shiftX; r0 = render(dx0);
  const iouAt = (d: number): number => { let I = 0, U = 0; for (let y = meas.neckBaseY; y <= meas.hipY; y++) for (let x = 0; x < W; x++) { const a = ref[y * W + x]!, sx = x - d, b = sx >= 0 && sx < W ? r0.mask[y * W + sx]! : 0; if (a || b) U++; if (a && b) I++; } return I / Math.max(1, U); };
  let best = -1, dsh = 0; for (let d = -24; d <= 24; d++) { const v = iouAt(d); if (v > best) { best = v; dsh = d; } }
  const dx = dx0 + dsh; r0 = render(dx);
  const I = best, U = 1;
  // erreur de PROFONDEUR par ligne, indépendante de l'alignement horizontal : |largeur moteur − largeur réf| / largeur réf, de 0,65 h sous le cou à la crête iliaque
  let re = 0, rc = 0;
  for (let y = Math.round(meas.neckBaseY + 0.65 * meas.head.height); y <= meas.hipY; y++) {
    let a0 = W, a1 = -1, b0 = W, b1 = -1;
    for (let x = 0; x < W; x++) { if (ref[y * W + x]) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); } if (r0.mask[y * W + x]) { b0 = Math.min(b0, x); b1 = Math.max(b1, x); } }
    if (a1 > 0 && b1 > 0) { re += Math.abs((b1 - b0) - (a1 - a0)) / (a1 - a0); rc++; }
  }
  return { rowErr: re / Math.max(1, rc), iou: I / U, mask: r0.mask, rgba: r0.rgba, dx, s, oy: oy2 };
}
if (process.argv[1]?.endsWith('profile-iou.ts')) {
  const host = bodyHost();
  for (const n of ['veryMuscular', 'muscular', 'adultMale'] as const) for (const yaw of [90, -90] as const) {
    const r = profileFit(ARCHETYPES[n] as BodyInput, yaw, host);
    console.log(n.padEnd(13), `yaw ${yaw}`.padEnd(8), `IoU profil = ${r.iou.toFixed(3)} erreur-profondeur/ligne = ${(r.rowErr * 100).toFixed(1)} %  dx=${r.dx.toFixed(1)} échelle=${r.s.toFixed(3)}`);
  }
}
