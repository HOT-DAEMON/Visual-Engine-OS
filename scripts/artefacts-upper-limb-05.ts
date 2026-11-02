/**
 * Artefacts de l'itération 05 (raccord épaule ↔ bras, bassin et jambes, rendu sans trous) : `npx tsx scripts/artefacts-upper-limb-05.ts` → artefacts/upper-limb-05/
 * Prérequis : `avant/` et `apres/` produits par `scripts/body-refs/junction-snap.ts` (avant = itération 04 dans un worktree).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, composeFigure, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumes, renderVolumesPixel, type Camera } from '../src/body/volume';
import { verifyJunctions } from '../src/verify';
import { BG, bodyHost } from './lib/body-host';
import { rasterPng } from './lib/raster';
import { loadRef } from './body-refs/iou';

const OUT = 'artefacts/upper-limb-05', H = bodyHost();
const uri = (p: string, mime = 'image/png'): string => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const T = (x: number, y: number, t: string, s = 15, c = '#e8ecf5', a = 'middle'): string => `<text x="${x}" y="${y}" fill="${c}" font-family="DejaVu Sans" font-size="${s}" text-anchor="${a}">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const cam = (yaw: number): Camera => ({ yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } });
const png = (name: string, w: number, h: number, body: string, fit = Math.min(2000, w)): void => writeFileSync(`${OUT}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`, { fonts: true, fitWidth: fit }));
const pair = (name: string, file: string, aspect: number, w = 900, cap = ['AVANT (itération 04)', 'APRÈS (itération 05)']): void => png(name, 2 * w + 30, w * aspect + 50, [0, 1].map((i) => `<image x="${10 + i * (w + 10)}" y="35" width="${w}" height="${w * aspect}" href="${uri(`${OUT}/${i ? 'apres' : 'avant'}/${file}.png`)}"/>${T(10 + i * (w + 10) + w / 2, 24, cap[i]!, 17)}`).join(''));
const m = (arch: keyof typeof ARCHETYPES, yaw: number, hp: number) => renderVolumesPixel(bodyVolumes(ARCHETYPES[arch] as BodyInput, H.a, {}), { skin: H.skin, heightPx: hp, camera: cam(yaw), uid: `a${arch}${yaw}` });

// 01 — corps entier AVEC LA TÊTE (même ancre de cou), de la tête aux chevilles
{ const r = m('veryMuscular', 0, 1800), full = composeFigure(H.svg, { back: r.svg, front: '' }), y1 = Math.ceil(62 + 0.27 * r.bounds.y1 + 12); // canevas = translate(190 62) scale(0,27) de l'hôte
  const svg = full.replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `viewBox="0 -75 380 ${y1 + 75}" width="380" height="${y1 + 75}"`).replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="${y1 + 75}" fill="${BG}"/>`);
  writeFileSync(`${OUT}/01-corps-avec-tete.png`, rasterPng(svg, { fitWidth: 700 })); }
// 02 — épaule gauche de face : avant | après ; 03 — haut en trois-quarts ; 04 — ventre (taches de fond) ; 05 — hanche de face puis de dos
pair('02-epaule-avant-apres', 'epaule-face', 0.94, 800);
pair('03-haut-trois-quarts-avant-apres', 'haut-trois-quarts', 0.88, 700);
pair('04-ventre-trous-avant-apres', 'ventre-face', 0.88, 700, ['AVANT : le fond bleu-gris apparaît à travers le ventre', 'APRÈS : les muscles se fondent sur la peau']);
pair('05-hanche-face-avant-apres', 'hanche-face', 0.41, 1000, ['AVANT : le tronc s’arrête net à la crête', 'APRÈS : bassin, hanche et cuisses continus']);
pair('06-hanche-dos-avant-apres', 'hanche-dos', 0.41, 1000, ['AVANT (dos)', 'APRÈS (dos) : le fessier n’est plus coupé']);
// 07 — épaule gauche : ref-02 | moteur, alignés sur l'AXE du corps
{ const ref = loadRef('ref-02'), r = renderVolumes(bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {}), { skin: H.skin, camera: cam(0), uid: 'r2' }), s = (ref.meas.head.height as number) / H.a.h, hd = ref.meas.head.height as number;
  const vb = `${ref.meas.centerX - 1.9 * hd} ${ref.meas.neckBaseY - 0.4 * hd} ${1.9 * hd} ${3.4 * hd}`, k = 520 / (1.9 * hd), hh = 3.4 * hd * k;
  const left = `<svg x="10" y="35" width="520" height="${hh}" viewBox="${vb}"><image width="${ref.w}" height="${ref.h}" href="${uri(ref.meas.file as string, 'image/jpeg')}"/></svg>`;
  const right = `<svg x="540" y="35" width="520" height="${hh}" viewBox="${vb}"><rect width="${ref.w}" height="${ref.h}" fill="${BG}"/><g transform="translate(${ref.meas.centerX} ${ref.meas.neckBaseY - H.a.baseY * s}) scale(${s})">${r.svg}</g></svg>`;
  png('07-epaule-ref02-vs-moteur', 1070, hh + 50, left + right + T(270, 24, 'ref-02 (écorché de référence)', 16) + T(800, 24, 'moteur après itération 05 (très musclé)', 16)); }
// 08 — vues libres du corps entier (face, 3/4, profil, 3/4 arrière, dos)
{ const cw = 400, ch = 860; png('08-vues-libres', 5 * cw, ch, [0, 35, 90, 145, 180].map((y, i) => { const r = m('veryMuscular', y, 760), b = r.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min((cw - 20) / w, (ch - 50) / h); return `<svg x="${i * cw + (cw - w * k) / 2}" y="10" width="${w * k}" height="${h * k}" viewBox="${b.x0} ${b.y0} ${w} ${h}">${r.svg}</svg>${T(i * cw + cw / 2, ch - 14, `yaw ${y}°`)}`; }).join(''), 2000); }
// 09 — vérification 3 couches (verifyJunctions) sur trois morphologies
{ const names = ['adultMale', 'veryMuscular', 'child'] as const, rows: string[] = []; let tot = 0, bad = 0;
  names.forEach((n, i) => { const raw = ARCHETYPES[n] as BodyInput, r = verifyJunctions(bodyVolumes(raw, H.a, {}), raw, H.a); rows.push(T(20, 28 + i * 0 + 0, '', 1)); r.checks.forEach((c, j) => { tot++; if (!c.ok) bad++; rows.push(T(20, 62 + i * 300 + j * 22, `${c.ok ? '✔' : '✘'} [${c.layer}] ${c.id.replace('junction.', '')} — ${c.detail.slice(0, 150)}`, 12, c.ok ? '#bfe8c4' : '#ff8a8a', 'start')); }); rows.push(T(20, 40 + i * 300, `${n} : ${r.ok ? 'aucun échec' : 'ÉCHECS'} (${r.checks.length} contrôles)`, 16, '#ffe9a8', 'start')); });
  png('09-verification-raccords', 1700, 920, rows.join(''), 1700); console.log(`vérification : ${tot - bad}/${tot} contrôles ok`); }
console.log('artefacts →', OUT);
