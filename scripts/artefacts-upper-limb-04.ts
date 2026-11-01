/**
 * Artefacts de l'itération 04 (haut du dos, omoplate, colonne du tronc, vue de dos) : `npx tsx scripts/artefacts-upper-limb-04.ts` → artefacts/upper-limb-04/
 * Prérequis : `avant/` et `apres/` produits par `scripts/body-refs/snap.ts` (avant = commit précédent dans un worktree).
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, composeFigure, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel, type Camera } from '../src/body/volume';
import { verifyBack } from '../src/verify';
import { BG, bodyHost } from './lib/body-host';
import { rasterPng } from './lib/raster';
import { profileBands } from './body-refs/profile-edges';
import { backRows } from './body-refs/back-measure';

const OUT = 'artefacts/upper-limb-04', H = bodyHost();
const uri = (p: string, mime: string): string => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const T = (x: number, y: number, t: string, s = 15, c = '#e8ecf5'): string => `<text x="${x}" y="${y}" fill="${c}" font-family="DejaVu Sans" font-size="${s}" text-anchor="middle">${t}</text>`;
const cam = (yaw: number): Camera => ({ yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } });
const svgWrap = (w: number, h: number, body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
const png = (name: string, w: number, h: number, body: string, fit = Math.min(2000, w)): void => writeFileSync(`${OUT}/${name}.png`, rasterPng(svgWrap(w, h, body), { fonts: true, fitWidth: fit }));
const px = (arch: keyof typeof ARCHETYPES, yaw: number, hp = 760) => renderVolumesPixel(bodyVolumes(ARCHETYPES[arch] as BodyInput, H.a, {}), { skin: H.skin, heightPx: hp, camera: cam(yaw), uid: `a${arch}${yaw}` });
const cell = (i: number, m: { svg: string; bounds: { x0: number; y0: number; x1: number; y1: number } }, cap: string, cw: number, ch: number): string => { const b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min((cw - 20) / w, (ch - 50) / h); return `<svg x="${i * cw + (cw - w * k) / 2}" y="10" width="${w * k}" height="${h * k}" viewBox="${b.x0} ${b.y0} ${w} ${h}">${m.svg}</svg>${T(i * cw + cw / 2, ch - 14, cap)}`; };

// 01 — corps complet AVEC LA TÊTE du moteur de visage (même personne, même ancre de cou), face
{ const m = px('veryMuscular', 0, 1500); const full = composeFigure(H.svg, { back: m.svg, front: '' }).replace('viewBox="0 0 380 700" width="380" height="700"', 'viewBox="0 -75 380 640" width="380" height="640"'); writeFileSync(`${OUT}/01-corps-avec-tete.png`, rasterPng(full.replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="640" fill="${BG}"/>`), { fitWidth: 900 })); }
// 02 — vues libres : face, trois-quarts, profil, trois-quarts arrière, dos
png('02-vues-libres', 2100, 780, [0, 35, 90, 145, 180].map((y, i) => cell(i, px('veryMuscular', y), `yaw ${y}°`, 420, 780)).join(''));
// 03 — profil de ref-04 : référence | avant | après (rouge = référence seule, bleu = moteur seul)
{ const a = JSON.parse(readFileSync(`${OUT}/avant/metrics.json`, 'utf8')), b = JSON.parse(readFileSync(`${OUT}/apres/metrics.json`, 'utf8')), W = 564, Hh = 771, k = 0.95;
  const panel = (i: number, img: string, cap: string): string => `<image x="${10 + i * (W * k + 10)}" y="30" width="${W * k}" height="${Hh * k}" href="${img}"/>${T(10 + i * (W * k + 10) + (W * k) / 2, 20, cap, 14)}`;
  png('03-profil-ref04-avant-apres', 3 * W * k + 40, Hh * k + 50, panel(0, uri('references/anatomy/ref-04-homme-ecorche-profil-face.jpg', 'image/jpeg'), 'ref-04 (photo)') + panel(1, uri(`${OUT}/avant/profile-overlay.png`, 'image/png'), `AVANT — IoU ${a.iou.toFixed(3)} · profondeur ${(a.rowErr * 100).toFixed(1)} % (zone entre pointillés)`) + panel(2, uri(`${OUT}/apres/profile-overlay.png`, 'image/png'), `APRÈS — IoU ${b.iou.toFixed(3)} · profondeur ${(b.rowErr * 100).toFixed(1)} % (rouge = réf seule, bleu = moteur seul)`), 1700); }
// 04 — haut du dos (très musclé) : avant | après
png('04-dos-omoplate-avant-apres', 2040, 760, `<image x="10" y="10" width="1000" height="${1000 * 0.62}" href="${uri(`${OUT}/avant/back-zoom.png`, 'image/png')}"/><image x="1030" y="10" width="1000" height="${1000 * 0.62}" href="${uri(`${OUT}/apres/back-zoom.png`, 'image/png')}"/>${T(510, 700, 'AVANT (commit 1f03bd4)', 18)}${T(1530, 700, 'APRÈS — omoplate placée en vertèbres, atome caché, coussinets', 18)}`, 1700);
// 05 — vue de dos : ref-01 (silhouette mesurée) | moteur féminin de dos, + largeurs mesurées
{ const rows = backRows(), side = backRows(ARCHETYPES.adultFemale as BodyInput, 'side'), m = px('adultFemale', 180, 760), b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min(420 / w, 640 / h);
  const lines = rows.map((r) => `${r.k.toFixed(1)} h : réf ${r.ref.toFixed(2)} · moteur ${r.mot.toFixed(2)} (${(r.ecart * 100).toFixed(0)} %)`);
  png('05-dos-ref01-vs-moteur', 1240, 760, `<svg x="10" y="20" width="420" height="640" viewBox="55 5 240 810" preserveAspectRatio="xMidYMid meet"><image href="${uri('references/anatomy/ref-01-femme-zbrush-3vues.jpg', 'image/jpeg')}" width="874" height="826"/></svg><svg x="450" y="20" width="${w * k}" height="${h * k}" viewBox="${b.x0} ${b.y0} ${w} ${h}">${m.svg}</svg>${T(220, 690, 'ref-01 (dos)', 15)}${T(450 + (w * k) / 2, 690, 'moteur · adultFemale · dos', 15)}${lines.map((l, i) => T(1050, 80 + i * 26, l, 13)).join('')}${T(1050, 60, 'largeur de la silhouette (têtes sous le cou)', 13, '#9fb0d6')}${T(1050, 250, `profil (profondeur) à 0,5 h : réf ${side[0]!.ref.toFixed(2)} · moteur ${side[0]!.mot.toFixed(2)}`, 12)}${T(1050, 285, 'dos : seules les lignes 0,5 h (épaules) sont', 11, '#e0b36a')}${T(1050, 301, 'comparables ; au-delà ce sont les bras (pose)', 11, '#e0b36a')}${T(1050, 323, 'profil ≥ 2 h : tronc seul, sans jambes', 11, '#e0b36a')}`, 1240);
  writeFileSync(`${OUT}/_back-rows.json`, JSON.stringify({ dos: rows, profil: side })); }
// 06 — écarts de profil par bande (moteur − ref-04), unités de tête
{ const r = profileBands(), bw = 70, bars = r.bands.map((b, i) => { const x = 60 + i * 150, sc = 400; const bar = (v: number, dx: number, c: string): string => `<rect x="${x + dx}" y="${v >= 0 ? 260 - v * sc : 260}" width="50" height="${Math.max(1, Math.abs(v) * sc)}" fill="${c}"/>`; return bar(b.dos, 0, '#e2a23b') + bar(b.avant, 60, '#3b9ae2') + T(x + 55, 300, `bande ${b.t.toFixed(2)}`, 12); }).join('');
  png('06-bandes-profil', 1300, 360, `${bars}<line x1="40" y1="260" x2="1260" y2="260" stroke="#9fb0d6" stroke-width="1"/>${T(650, 24, 'écart moteur − ref-04 par bande cou→crête (en têtes ; orange = dos, bleu = avant ; + = moteur plus en arrière / plus en avant)', 14)}${T(650, 335, `IoU ${r.iou.toFixed(3)} · erreur de profondeur ${(r.rowErr * 100).toFixed(1)} %`, 14)}`, 1300); void bw; }
// 07 — vérification du dos : 3 couches × archétypes (tableau)
{ const names = ['adultMale', 'adultFemale', 'veryMuscular', 'muscular', 'child'] as const, reps = names.map((n) => verifyBack(bodyVolumes(ARCHETYPES[n] as BodyInput, H.a, {}), ARCHETYPES[n] as BodyInput, H.a)), ids = reps[0]!.checks.map((c) => c.id);
  const rows = ids.map((id, i) => T(330, 90 + i * 24, id, 12, '#cdd6ee').replace('text-anchor="middle"', 'text-anchor="end"') + reps.map((r, j) => { const c = r.checks.find((q) => q.id === id)!; return T(420 + j * 120, 90 + i * 24, c.ok ? '✔' : '✘', 14, c.ok ? '#6ad39a' : '#ff6b6b'); }).join('')).join('');
  png('07-verification-dos', 1050, 120 + ids.length * 24, `${T(525, 28, 'verifyBack — géométrie · anatomie · style (✔ = passe)', 16)}${names.map((n, j) => T(420 + j * 120, 62, n, 12, '#9fb0d6')).join('')}${rows}`, 1050);
  writeFileSync(`${OUT}/rapport.json`, JSON.stringify({ profil: { avant: JSON.parse(readFileSync(`${OUT}/avant/metrics.json`, 'utf8')), apres: JSON.parse(readFileSync(`${OUT}/apres/metrics.json`, 'utf8')), bandes: profileBands().bands }, vueDeDos: JSON.parse(readFileSync(`${OUT}/_back-rows.json`, 'utf8')), verifyBack: Object.fromEntries(names.map((n, j) => [n, reps[j]!.checks.map((c) => ({ id: c.id, layer: c.layer, ok: c.ok, detail: c.detail }))])) }, null, 1)); }
if (existsSync(`${OUT}/_back-rows.json`)) { try { copyFileSync(`${OUT}/_back-rows.json`, `${OUT}/_back-rows.json`); } catch { /* noop */ } }
console.log('artefacts écrits dans', OUT);
