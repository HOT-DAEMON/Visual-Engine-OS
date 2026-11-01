/**
 * MESURE DE LA VUE DE DOS (et du profil féminin) à `ref-01` (mannequin ZBrush, 3 vues, même échelle). Premières mesures en pixels de ref-01 (itération 04).
 * Conventions ASSUMÉES (pas des propriétés de la référence) :
 *  - unité = hauteur de tête de la référence = 100 px (moyenne des trois vues : 100 / 94 / 106 selon la ligne la plus étroite du cou) ;
 *  - la hauteur de tête du moteur est `host.a.h` ; la ligne de départ est la base du cou (`a.baseY` / `neckBaseRow`) ;
 *  - ref-01 est un mannequin STYLISÉ (bras détachés, fessiers très marqués) : l'écart est une mesure, pas un verdict d'anatomie.
 * Largeur par ligne = étendue gauche–droite de la silhouette entière (bras compris, des deux côtés), en unités de tête.
 */
import { Resvg } from '@resvg/resvg-js';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes, renderVolumes, type Camera } from '../../src/body/volume';
import { bodyHost } from '../lib/body-host';

const M = JSON.parse(readFileSync('references/anatomy/measures.json', 'utf8'))['ref-01'], W = 874, HH = 100;
const mask = (n: 'back' | 'side'): Uint8Array => { const b = gunzipSync(readFileSync(`references/anatomy/ref-01.${n}.silhouette.gz`)), m = new Uint8Array(W * 826); for (let i = 0; i < m.length; i++) m[i] = (b[i >> 3]! >> (7 - (i & 7))) & 1; return m; };
const span = (m: Uint8Array, y: number, w: number): [number, number] => { let a = w, b = -1; for (let x = 0; x < w; x++) if (m[y * w + x]) { a = Math.min(a, x); b = Math.max(b, x); } return [a, b]; };
export const LEVELS = [0.5, 1, 1.5, 2, 2.5, 3] as const;
export interface Row { readonly k: number; readonly ref: number; readonly mot: number; readonly ecart: number }
/** Largeurs (unités de tête) à k têtes sous la base du cou : référence vs moteur. `view` : back = dos (largeur), side = profil (profondeur). */
export function backRows(arch: BodyInput = ARCHETYPES.adultFemale as BodyInput, view: 'back' | 'side' = 'back'): Row[] {
  const host = bodyHost(), set = bodyVolumes(arch, host.a, {}), ref = mask(view), nb = M[view].neckBaseRow + M[view].top - M[view].top, top = M[view].top;
  const cam: Camera = { yaw: view === 'back' ? 180 : 90, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, mk = renderVolumes(set, { skin: host.skin, camera: cam, uid: 'bm' }), b = mk.bounds, s = HH / host.a.h;
  const pw = Math.ceil((b.x1 - b.x0) * s) + 2, ph = Math.ceil((b.y1 - b.y0) * s) + 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${pw} ${ph}"><g transform="translate(${-b.x0 * s} ${-b.y0 * s}) scale(${s})">${mk.svg}</g></svg>`;
  const px = new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels, em = new Uint8Array(pw * ph); for (let i = 0; i < em.length; i++) em[i] = px[i * 4 + 3]! > 40 ? 1 : 0;
  const yBaseM = (host.a.baseY - b.y0) * s;
  return LEVELS.map((k) => { const [r0, r1] = span(ref, Math.round(top + nb + k * HH), W), [e0, e1] = span(em, Math.round(yBaseM + k * HH), pw), r = (r1 - r0 + 1) / HH, e = e1 >= 0 ? (e1 - e0 + 1) / HH : 0; return { k, ref: r, mot: e, ecart: (e - r) / r }; });
}
if (process.argv[1]?.endsWith('back-measure.ts')) for (const v of ['back', 'side'] as const) {
  console.log(`\n${v === 'back' ? 'DOS — largeur' : 'PROFIL — profondeur'} (têtes) : sous la base du cou   réf   moteur   écart`);
  for (const r of backRows(ARCHETYPES.adultFemale as BodyInput, v)) console.log(`  ${r.k.toFixed(1)} h`.padEnd(10), r.ref.toFixed(2).padStart(8), r.mot.toFixed(2).padStart(8), `${(r.ecart * 100).toFixed(0)} %`.padStart(7));
}
