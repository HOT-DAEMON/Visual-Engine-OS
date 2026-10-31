/**
 * MESURE DE FIDÉLITÉ À LA RÉFÉRENCE (couche « silhouette ») : IoU entre la silhouette du membre supérieur rendue par le moteur et celle de
 * `references/anatomy/ref-02` (masque extrait par `extract.py`). Alignement par DEUX repères seulement (base du cou, bout des doigts) →
 * échelle uniforme ; l'écart de largeur (envergure, épaules, taille) n'est PAS corrigé : il est mesuré.
 * Région comparée : y∈[cou, crête iliaque `hipY`] entier ; en dessous seulement les bras/mains (le tronc du moteur s'arrête aux hanches, les jambes de la référence sont exclues).
 */
import { Resvg } from '@resvg/resvg-js';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { bodyVolumes, renderVolumes, type Camera } from '../../src/body/volume';
import type { BodyInput, NeckAnchor } from '../../src/body';

export interface Ref { readonly w: number; readonly h: number; readonly m: Uint8Array; readonly meas: any }
export function loadRef(): Ref {
  const meas = JSON.parse(readFileSync('references/anatomy/measures.json', 'utf8'))['ref-02'];
  const [w, h] = meas.size as [number, number], bits = gunzipSync(readFileSync('references/anatomy/ref-02.silhouette.gz')), m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = (bits[i >> 3]! >> (7 - (i & 7))) & 1;
  return { w, h, m, meas };
}
export interface Fit { readonly s: number; readonly ox: number; readonly oy: number; readonly mask: Uint8Array; readonly rgba: Uint8Array }
const CAM: Camera = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
/** Rend le corps (de face, sans fond) dans la grille de la référence. `svgOf` permet de brancher un autre rendu (ex. pixel). */
export function fitToRef(ref: Ref, body: BodyInput, a: NeckAnchor, skin: string, svgOf?: (set: ReturnType<typeof bodyVolumes>) => string): Fit {
  const set = bodyVolumes(body, a, {});
  let fy = -Infinity, xl = Infinity, xr = -Infinity;
  for (const v of set.volumes) if (v.group === 'hand') for (const s of v.stations) { fy = Math.max(fy, s.c.y); xl = Math.min(xl, s.c.x); xr = Math.max(xr, s.c.x); }
  const m = renderVolumes(set, { skin, camera: CAM, uid: 'iou' });
  const markup = svgOf ? svgOf(set) : m.svg;
  // échelle : (bout des doigts − base du cou) hôte → même distance dans la référence
  const s = (ref.meas.fingertipY - ref.meas.neckBaseY) / (fy - a.baseY);
  const cxHost = m.bounds.x0 + (m.bounds.x1 - m.bounds.x0) / 2;
  const ox = ref.meas.centerX - cxHost * s, oy = ref.meas.neckBaseY - a.baseY * s;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ref.w}" height="${ref.h}" viewBox="0 0 ${ref.w} ${ref.h}"><g transform="translate(${ox} ${oy}) scale(${s})">${markup}</g></svg>`;
  const img = new Resvg(svg, { font: { loadSystemFonts: false } }).render(), px = img.pixels;
  const mask = new Uint8Array(ref.w * ref.h);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3]! > 40 ? 1 : 0;
  return { s, ox, oy, mask, rgba: new Uint8Array(px) };
}
export interface Iou { readonly iou: number; readonly rowErr: number; readonly spanRatio: number; readonly shoulderRatio: number; readonly handY: number }
export function silhouetteIou(ref: Ref, f: Fit): Iou {
  const { w, h, meas } = ref, cx = meas.centerX, inter = { n: 0, u: 0 };
  const inRegion = (x: number, y: number): boolean => y >= meas.neckBaseY && (y <= meas.hipY || (y <= meas.fingertipY + 8 && Math.abs(x - cx) > 118));
  let re = 0, rn = 0, sx0 = Infinity, sx1 = -Infinity, rsx0 = Infinity, rsx1 = -Infinity;
  for (let y = meas.neckBaseY; y <= meas.fingertipY; y++) {
    let a0 = w, a1 = -1, b0 = w, b1 = -1;
    for (let x = 0; x < w; x++) {
      if (!inRegion(x, y)) continue;
      const a = ref.m[y * w + x]!, b = f.mask[y * w + x]!;
      if (a || b) inter.u++; if (a && b) inter.n++;
      if (a) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); } if (b) { b0 = Math.min(b0, x); b1 = Math.max(b1, x); }
    }
    if (a1 > 0 && b1 > 0) { re += Math.abs((b1 - b0) - (a1 - a0)) / (a1 - a0); rn++; }
  }
  for (let y = 150; y < 300; y++) for (let x = 0; x < w; x++) { if (ref.m[y * w + x]) { rsx0 = Math.min(rsx0, x); rsx1 = Math.max(rsx1, x); } if (f.mask[y * w + x]) { sx0 = Math.min(sx0, x); sx1 = Math.max(sx1, x); } }
  let ox0 = Infinity, ox1 = -Infinity, rx0 = Infinity, rx1 = -Infinity, hy = 0;
  for (let y = meas.neckBaseY; y <= meas.fingertipY + 30; y++) for (let x = 0; x < w; x++) { if (f.mask[y * w + x]) { ox0 = Math.min(ox0, x); ox1 = Math.max(ox1, x); if (Math.abs(x - cx) > 118) hy = Math.max(hy, y); } if (ref.m[y * w + x]) { rx0 = Math.min(rx0, x); rx1 = Math.max(rx1, x); } }
  void h;
  return { iou: inter.n / Math.max(1, inter.u), rowErr: re / Math.max(1, rn), spanRatio: (ox1 - ox0) / (rx1 - rx0), shoulderRatio: (sx1 - sx0) / (rsx1 - rsx0), handY: hy };
}
if (process.argv[1]?.endsWith('iou.ts')) {
  const { bodyHost } = await import('../lib/body-host');
  const { ARCHETYPES } = await import('../../src/body');
  const H = bodyHost(), ref = loadRef();
  for (const n of ['veryMuscular', 'muscular', 'adultMale'] as const) {
    const f = fitToRef(ref, ARCHETYPES[n] as BodyInput, H.a, H.skin), r = silhouetteIou(ref, f);
    console.log(n.padEnd(14), `IoU=${r.iou.toFixed(3)} erreur-largeur/ligne=${(r.rowErr * 100).toFixed(1)}% envergure×=${r.spanRatio.toFixed(3)} épaules×=${r.shoulderRatio.toFixed(3)} échelle=${f.s.toFixed(3)}`);
  }
}
