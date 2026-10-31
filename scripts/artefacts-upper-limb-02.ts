/**
 * Images brutes des artefacts « membre supérieur 02 » (deltoïde + trapèze en masses continues, second masque ref-04).
 * `npx tsx scripts/artefacts-upper-limb-02.ts <dossier> <pose-ref02.json> <pose-ref04.json>` ; la mise en page finale est faite par `scripts/artefacts-upper-limb-02.py`.
 * Lancé sur le commit précédent (worktree) ET sur le courant : mêmes images, mêmes poses, donc comparaison avant/après honnête.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, BodyParams, composeFigure, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel, renderVolumes, type Camera } from '../src/body/volume';
import { BG, bodyHost } from './lib/body-host';
import { fitToRef, loadRef, silhouetteIou } from './body-refs/iou';
import { overlayPng } from './body-refs/overlay';
import { outerWall, topContour } from './body-refs/contour';
import { rasterPng } from './lib/raster';

const OUT = process.argv[2] ?? 'artefacts/upper-limb-02/raw', P02 = JSON.parse(process.argv[3] ?? '{"abduction":11,"forearmSwing":1,"elbowFlex":23,"pronation":-0.575}'), P04 = JSON.parse(process.argv[4] ?? '{"abduction":18,"forearmSwing":-8,"elbowFlex":0,"pronation":-0.35}');
mkdirSync(OUT, { recursive: true });
const H = bodyHost(), posed = (pose: object): BodyInput => { const b: any = JSON.parse(JSON.stringify(BodyParams.parse(ARCHETYPES.veryMuscular))); for (const s of ['left', 'right']) Object.assign(b.pose[s], pose); return b; };
const cam = (yaw: number, pitch = -2): Camera => ({ yaw, pitch, pivot: { x: 0, y: 0, z: 0 } });
const set = bodyVolumes(posed(P02), H.a, {});
const png = (svg: string, wd: number): Buffer => new Resvg(svg, { fitTo: { mode: 'width', value: wd } }).render().asPng();
const frame = (m: { svg: string; bounds: { x0: number; y0: number; x1: number; y1: number } }, wd: number, crop?: [number, number, number, number]): Buffer => { const b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, c = crop ?? [0, 0, 1, 1]; return png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0 + w * c[0]} ${b.y0 + h * c[1]} ${w * (c[2] - c[0])} ${h * (c[3] - c[1])}"><rect x="${b.x0}" y="${b.y0}" width="${w}" height="${h}" fill="${BG}"/>${m.svg}</svg>`, wd); };
const px = (yaw: number, hp: number, o: object = {}) => renderVolumesPixel(set, { skin: H.skin, heightPx: hp, camera: cam(yaw), uid: 'a', ...o });
// 01 corps + tête complète (même personne, même ancre de cou)
{ const m = px(0, 1500, { camera: cam(0, 0) }); const full = composeFigure(H.svg, { back: m.svg, front: '' }).replace('viewBox="0 0 380 700" width="380" height="700"', 'viewBox="0 -75 380 640" width="380" height="640"'); writeFileSync(`${OUT}/full.png`, rasterPng(full.replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="640" fill="${BG}"/>`), { fitWidth: 900 })); }
// 02 vues libres
for (const y of [0, 35, 90, 145, 180]) writeFileSync(`${OUT}/view-${y}.png`, frame(px(y, 900), 520));
// 03 gros plans de l'épaule : face, trois-quarts, profil, dos
for (const y of [0, 35, 90, 180]) writeFileSync(`${OUT}/shoulder-${y}.png`, frame(px(y, 1700), 760, [0.0, 0.0, 0.62, 0.34]));
// 04 un volume = une couleur (preuve des masses) et écorché sans peau
writeFileSync(`${OUT}/atoms.png`, frame(renderVolumes(set, { skin: H.skin, camera: cam(0), mode: 'atoms', uid: 'at', level: 3, forceTier: true }) as never, 760, [0, 0, 1, 0.5]));
writeFileSync(`${OUT}/shoulder-flayed.png`, frame(px(0, 1700, { hideFromLayer: 5, forceTier: true }), 760, [0.0, 0.0, 0.62, 0.34]));
// 05 silhouettes et contours mesurés (pose calibrée de chaque référence)
const report: Record<string, unknown> = {};
for (const [rn, pose] of [['ref-02', P02], ['ref-04', P04]] as const) {
  const ref = loadRef(rn), f = fitToRef(ref, posed(pose), H.a, H.skin), r = silhouetteIou(ref, f), y0 = ref.meas.neckBaseY - 0.2 * ref.meas.head.height, y1 = ref.meas.neckBaseY + 1.5 * ref.meas.head.height;
  writeFileSync(`${OUT}/silhouette-${rn}.png`, overlayPng(ref, f.mask));
  const rows = Array.from({ length: 33 }, (_, i) => 0.5 + 0.1 * i);
  report[rn] = { pose, iou: r.iou, rowErr: r.rowErr, spanRatio: r.spanRatio, shoulderRatio: r.shoulderRatio, top: { ref: topContour(ref.m, ref, y0, y1), engine: topContour(f.mask, ref, y0, y1) }, wall: { rows, ref: outerWall(ref.m, ref, rows), engine: outerWall(f.mask, ref, rows) } };
}
// 06 vérification en 3 couches (absente du commit précédent : le module n'existait pas)
try { const { verifyShoulders } = await import('../src/verify/shoulder'); const v = verifyShoulders(px(0, 700), set, H.a); report.verification = { ok: v.ok, checks: v.checks }; } catch { report.verification = null; }
writeFileSync(`${OUT}/measures.json`, JSON.stringify(report));
console.log('ok', OUT);
