/**
 * Artefacts du membre supérieur (rendu par pixel + fidélité à ref-02) : `npx tsx scripts/artefacts-upper-limb.ts [avant.png]` → artefacts/upper-limb/
 * `avant.png` = superposition produite par le MÊME outil sur le commit précédent (voir docs/BODY-UPPER-LIMB.md).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, composeFigure, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel, type Camera } from '../src/body/volume';
import { verifyPixels } from '../src/verify';
import { BG, bodyHost } from './lib/body-host';
import { fitToRef, loadRef, silhouetteIou } from './body-refs/iou';
import { overlayPng } from './body-refs/overlay';
import { rasterPng } from './lib/raster';

const OUT = 'artefacts/upper-limb';
mkdirSync(OUT, { recursive: true });
const H = bodyHost(), ref = loadRef(), body = ARCHETYPES.veryMuscular as BodyInput, set = bodyVolumes(body, H.a, {});
const cam = (yaw: number, pitch = 0): Camera => ({ yaw, pitch, pivot: { x: 0, y: 0, z: 0 } });
const T = (x: number, y: number, t: string, s = 15): string => `<text x="${x}" y="${y}" fill="#e8ecf5" font-family="DejaVu Sans" font-size="${s}" text-anchor="middle">${t}</text>`;
const px = (yaw: number, h = 760, o: object = {}) => renderVolumesPixel(set, { skin: H.skin, heightPx: h, camera: cam(yaw, -2), uid: 'a', ...o });
const cell = (i: number, m: { svg: string; bounds: { x0: number; y0: number; x1: number; y1: number } }, cap: string, cw: number, ch: number): string => { const b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min((cw - 20) / w, (ch - 50) / h); return `<svg x="${i * cw + (cw - w * k) / 2}" y="${10 + (ch - 50 - h * k) / 2}" width="${w * k}" height="${h * k}" viewBox="${b.x0} ${b.y0} ${w} ${h}">${m.svg}</svg>${T(i * cw + cw / 2, ch - 14, cap)}`; };
const sheet = (name: string, cells: string[], cw: number, ch: number): void => writeFileSync(`${OUT}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cw * cells.length} ${ch}" width="${cw * cells.length}" height="${ch}"><rect width="${cw * cells.length}" height="${ch}" fill="${BG}"/>${cells.join('')}</svg>`, { fonts: true, fitWidth: Math.min(2400, cw * cells.length) }));

// 01 — corps par pixel + TÊTE complète du moteur de visage (même personne, même ancre de cou)
{ const m = px(0, 1500, { camera: cam(0) }), b = m.bounds; const full = composeFigure(H.svg, { back: m.svg, front: '' }).replace('viewBox="0 0 380 700" width="380" height="700"', 'viewBox="0 -75 380 640" width="380" height="640"'); const bgd = full.replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="640" fill="${BG}"/>`); writeFileSync(`${OUT}/01-corps-pixel-avec-tete.png`, rasterPng(bgd, { fitWidth: 900 })); void b; }
// 02 — vues libres par pixel
sheet('02-vues-pixel', [0, 35, 90, 145, 180].map((y, i) => cell(i, px(y), `yaw ${y}°`, 420, 780)), 420, 780);
// 03 — silhouette : référence (rouge) / moteur (vert) / recouvrement (jaune), avant et après
{
  const f = fitToRef(ref, body, H.a, H.skin), r = silhouetteIou(ref, f), after = overlayPng(ref, f.mask);
  writeFileSync(`${OUT}/03b-silhouette-apres.png`, after);
  if (process.argv[2] && existsSync(process.argv[2])) copyFileSync(process.argv[2], `${OUT}/03a-silhouette-avant.png`);
  writeFileSync(`${OUT}/rapport.json`, JSON.stringify({ silhouetteApres: r, nbVolumes: set.volumes.length, verifPixels: (() => { const v = verifyPixels(px(0, 420), set); return { ok: v.ok, checks: v.checks }; })() }, null, 1));
}
// 04 — référence vs moteur (même hauteur, haut du corps)
{
  const m = px(0, 1100), refUri = `data:image/jpeg;base64,${readFileSync('references/anatomy/ref-02-homme-muscles-colores.jpg').toString('base64')}`, b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0;
  const rh = 520, rw = rh * (736 / 891) * (891 / 520) * 0.55; void rw;
  const left = `<svg x="10" y="20" width="440" height="640" viewBox="140 20 460 620"><image href="${refUri}" width="736" height="891"/></svg>`;
  const k = Math.min(440 / w, 640 / h);
  const right = `<svg x="470" y="20" width="${w * k}" height="${h * k}" viewBox="${b.x0} ${b.y0} ${w} ${h}">${m.svg}</svg>`;
  writeFileSync(`${OUT}/04-reference-vs-moteur.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 700" width="940" height="700"><rect width="940" height="700" fill="${BG}"/>${left}${right}${T(230, 686, 'ref-02 (haut du corps)')}${T(710, 686, 'moteur · pixel · veryMuscular')}</svg>`, { fonts: true }));
}
// 05 — mains : zoom du rendu pixel
{
  const m = px(0, 2400), b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0} ${b.y0 + h * 0.62} ${w} ${h * 0.38}" width="1800"><rect x="${b.x0}" y="${b.y0}" width="${w}" height="${h}" fill="${BG}"/>${m.svg}</svg>`).render();
  writeFileSync(`${OUT}/05-avant-bras-et-mains.png`, r.asPng());
}
console.log('artefacts écrits dans', OUT);
