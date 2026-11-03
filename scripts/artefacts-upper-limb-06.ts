/**
 * Artefacts de l'itération 06 (jambes 3D complètes, source unique 2D/3D, rampe poitrine → ventre) : `npx tsx scripts/artefacts-upper-limb-06.ts` → artefacts/upper-limb-06/
 * Prérequis : `avant/` et `apres/` produits par `scripts/body-refs/legs-snap.ts` (avant = itération 05 dans un worktree) et `rampe-profil.json` (bandes de profil, mêmes dossiers).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, composeFigure, type BodyInput } from '../src/body';
import { figureBounds, figureMarkup, legGeometry } from '../src/body/lower';
import { bodyVolumes, renderVolumes, renderVolumesPixel, type Camera } from '../src/body/volume';
import { verifyLegs3D } from '../src/verify';
import { BG, bodyHost } from './lib/body-host';
import { rasterPng } from './lib/raster';
import { loadRef } from './body-refs/iou';

const OUT = 'artefacts/upper-limb-06', H = bodyHost();
const uri = (p: string, mime = 'image/png'): string => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const T = (x: number, y: number, t: string, s = 15, c = '#e8ecf5', a = 'middle'): string => `<text x="${x}" y="${y}" fill="${c}" font-family="DejaVu Sans" font-size="${s}" text-anchor="${a}">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const cam = (yaw: number): Camera => ({ yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } });
const png = (name: string, w: number, h: number, body: string, fit = Math.min(2000, w)): void => writeFileSync(`${OUT}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`, { fonts: true, fitWidth: fit }));
const pair = (name: string, file: string, aspect: number, w = 760, cap = ['AVANT (itération 05)', 'APRÈS (itération 06)']): void => png(name, 2 * w + 30, w * aspect + 50, [0, 1].map((i) => `<image x="${10 + i * (w + 10)}" y="35" width="${w}" height="${w * aspect}" href="${uri(`${OUT}/${i ? 'apres' : 'avant'}/${file}.png`)}"/>${T(10 + i * (w + 10) + w / 2, 24, cap[i]!, 17)}`).join(''));
const m = (arch: keyof typeof ARCHETYPES, yaw: number, hp: number, extra: object = {}) => renderVolumesPixel(bodyVolumes(ARCHETYPES[arch] as BodyInput, H.a, extra), { skin: H.skin, heightPx: hp, camera: cam(yaw), uid: `a${arch}${yaw}${JSON.stringify(extra).length}` });

// 01 — corps entier AVEC LA TÊTE (même ancre de cou), de la tête aux pieds
{ const r = m('veryMuscular', 0, 1800), full = composeFigure(H.svg, { back: r.svg, front: '' }), y1 = Math.ceil(62 + 0.27 * r.bounds.y1 + 12);
  const svg = full.replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `viewBox="0 -75 380 ${y1 + 75}" width="380" height="${y1 + 75}"`).replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="${y1 + 75}" fill="${BG}"/>`);
  writeFileSync(`${OUT}/01-corps-avec-tete.png`, rasterPng(svg, { fitWidth: 700 })); }
pair('02-jambes-face-avant-apres', 'jambes-face', 1.11, 700); pair('03-jambes-trois-quarts-avant-apres', 'jambes-trois-quarts', 1.11, 700);
pair('04-jambes-profil-avant-apres', 'jambes-profil', 1.11, 700); pair('05-jambes-dos-avant-apres', 'jambes-dos', 1.11, 700);
pair('06-genou-face-avant-apres', 'genou-face', 0.87, 760, ['AVANT : un tube lisse', 'APRÈS : rotule, tubérosité, condyles, loges musculaires']);
pair('07-genou-profil-avant-apres', 'genou-profil', 0.87, 760, ['AVANT', 'APRÈS : rotule en saillie, quadriceps devant, ischio-jambiers derrière']);
pair('08-pied-trois-quarts-avant-apres', 'pied-trois-quarts', 0.53, 900, ['AVANT : pas de pied', 'APRÈS : talon, cou-de-pied, 5 orteils, ongles']); pair('09-pied-profil-avant-apres', 'pied-profil', 0.53, 900, ['AVANT', 'APRÈS']);
// 10 — jambes de ref-02 | moteur, alignés sur l'axe du corps et la base du cou
{ const ref = loadRef('ref-02'), r = renderVolumes(bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {}), { skin: H.skin, camera: cam(0), uid: 'r2' }), hd = ref.meas.head.height as number, s = hd / H.a.h;
  const y0 = (ref.meas.crotchY as number) - 0.3 * hd, hv = ref.h - y0, vb = `${ref.meas.centerX - 1.6 * hd} ${y0} ${3.2 * hd} ${hv}`, k = 520 / (3.2 * hd), hh = hv * k;
  const left = `<svg x="10" y="35" width="520" height="${hh}" viewBox="${vb}"><image width="${ref.w}" height="${ref.h}" href="${uri(ref.meas.file as string, 'image/jpeg')}"/></svg>`;
  const right = `<svg x="540" y="35" width="520" height="${hh}" viewBox="${vb}"><rect width="${ref.w}" height="${ref.h}" fill="${BG}"/><g transform="translate(${ref.meas.centerX} ${ref.meas.neckBaseY - H.a.baseY * s}) scale(${s})">${r.svg}</g></svg>`;
  png('10-jambes-ref02-vs-moteur', 1070, hh + 50, left + right + T(270, 24, 'ref-02 (muscles colorés par groupe)', 16) + T(800, 24, 'moteur itération 06 (très musclé)', 16)); }
// 11 — source unique : jambes 2D (module lower) | jambes 3D, même morphologie, mêmes paramètres
{ const mk = figureMarkup(ARCHETYPES.veryMuscular as BodyInput, {}, H.a, { skin: H.skin, uid: 'p2d' }), r = m('veryMuscular', 0, 1400), b = r.bounds, hh = b.y1 - b.y0, W = 0.5 * hh * (760 / (0.6 * hh)) * 0 + 560;
  const mb = figureBounds(legGeometry(ARCHETYPES.veryMuscular as BodyInput, {}, H.a)), mh = mb.y1 - mb.y0, mw = mb.x1 - mb.x0;
  const crop3 = `<svg x="10" y="40" width="${W}" height="760" viewBox="${(b.x0 + b.x1) / 2 - 0.5 * 0.6 * hh * (W / 760)} ${b.y0 + 0.4 * hh} ${0.6 * hh * (W / 760)} ${0.6 * hh}">${r.svg}</svg>`;
  const crop2 = `<svg x="${W + 30}" y="40" width="${W}" height="760" viewBox="${mb.x0} ${mb.y0 + 0.4 * mh} ${Math.max(mw, mh * 0.6 * (W / 760))} ${0.6 * mh}">${mk.back}${mk.front}</svg>`;
  png('11-source-unique-3d-vs-2d', 2 * W + 40, 810, crop3 + crop2 + T(10 + W / 2, 30, '3D : volumes (LEG_MUSCLES, LEG_LANDMARKS)', 16) + T(30 + 1.5 * W, 30, '2D : atomes (mêmes tables)', 16)); }
// 12 — vues libres du corps entier (face, 3/4, profil, 3/4 arrière, dos)
{ const cw = 400, ch = 860; png('12-vues-libres', 5 * cw, ch, [0, 35, 90, 145, 180].map((y, i) => { const r = m('veryMuscular', y, 760), b = r.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min((cw - 20) / w, (ch - 50) / h); return `<svg x="${i * cw + (cw - w * k) / 2}" y="10" width="${w * k}" height="${h * k}" viewBox="${b.x0} ${b.y0} ${w} ${h}">${r.svg}</svg>${T(i * cw + cw / 2, ch - 14, `yaw ${y}°`)}`; }).join(''), 2000); }
// 13 — poses : repos | genou gauche fléchi | écartement + pieds en dehors | orteils écartés et recourbés
{ const P: readonly (readonly [string, object])[] = [['repos', {}], ['genou gauche fléchi 50°', { legs: { pose: { left: { kneeFlex: 50 } } } }], ['écartement 18° + pieds en dehors 30°', { legs: { pose: { left: { abduction: 18, footTurnout: 30 }, right: { abduction: 18, footTurnout: 30 } } } }], ['orteils écartés 0,9 / recourbés 0,7', { legs: { pose: { left: { toeSpread: 0.9, toeCurl: 0.7 }, right: { toeSpread: 0.9, toeCurl: 0.7 } } } }]];
  const cw = 480, ch = 760; png('13-poses-jambes', 4 * cw, ch + 30, P.map(([t, ex], i) => { const r = m('veryMuscular', 25, 1500, ex), b = r.bounds, hh = b.y1 - b.y0, w = 0.5 * hh * (cw / ch); return `<svg x="${i * cw}" y="10" width="${cw}" height="${ch}" viewBox="${(b.x0 + b.x1) / 2 - w / 2} ${b.y0 + 0.42 * hh} ${w} ${0.58 * hh}">${r.svg}</svg>${T(i * cw + cw / 2, ch + 24, t, 15)}`; }).join(''), 1920); }
// 14 — rampe poitrine → ventre : profondeur du profil par bande, ref-04 | avant | après
{ const A = JSON.parse(readFileSync(`${OUT}/avant/rampe-profil.json`, 'utf8')), B = JSON.parse(readFileSync(`${OUT}/apres/rampe-profil.json`, 'utf8')); const W = 1000, Hh = 520, X = (t: number): number => 60 + t * (W - 100), Y = (d: number): number => Hh - 60 - (d - 0.6) * 520;
  let body = ''; ['adultMale', 'veryMuscular'].forEach((n, j) => { const ox = j * 1020; const line = (key: 'profRef' | 'profMot', src: { bands: { t: number; profRef: number; profMot: number }[] }, c: string, w = 2.5): string => `<polyline fill="none" stroke="${c}" stroke-width="${w}" points="${src.bands.map((q) => `${ox + X(q.t)},${Y(q[key])}`).join(' ')}"/>`;
    body += `<g>${line('profRef', B[n], '#ffe9a8', 3.5)}${line('profMot', A[n], '#ff8a8a')}${line('profMot', B[n], '#8fe3a1')}</g>${T(ox + 500, 30, `${n} — profondeur du tronc de profil (h)`, 16)}${T(ox + 130, Hh - 20, `IoU ${A[n].iou.toFixed(3)} → ${B[n].iou.toFixed(3)} · erreur de ligne ${A[n].rowErr.toFixed(3)} → ${B[n].rowErr.toFixed(3)}`, 13, '#e8ecf5', 'start')}`; });
  body += T(200, 62, '— ref-04', 14, '#ffe9a8') + T(330, 62, '— avant (it. 05)', 14, '#ff8a8a') + T(500, 62, '— après (it. 06)', 14, '#8fe3a1'); png('14-rampe-poitrine-ventre', 2040, Hh, body, 2000); }
// 15 — vérification des jambes 3D (3 couches) sur trois morphologies
{ const names = ['adultMale', 'veryMuscular', 'child'] as const, rows: string[] = []; let tot = 0, bad = 0;
  names.forEach((n, i) => { const raw = ARCHETYPES[n] as BodyInput, r = verifyLegs3D(bodyVolumes(raw, H.a, {}), raw, H.a); rows.push(T(20, 28 + i * 330, `${n} : ${r.ok ? 'aucun échec' : 'ÉCHECS'} (${r.checks.length} contrôles)`, 16, '#ffe9a8', 'start')); r.checks.forEach((c, j) => { tot++; if (!c.ok) bad++; rows.push(T(20, 56 + i * 330 + j * 22, `${c.ok ? '✔' : '✘'} [${c.layer}] ${c.id.replace('legs3d.', '')} — ${c.detail.slice(0, 165)}`, 11.5, c.ok ? '#bfe8c4' : '#ff8a8a', 'start')); }); });
  png('15-verification-jambes-3d', 1700, 1020, rows.join(''), 1700); console.log(`vérification : ${tot - bad}/${tot} contrôles ok`); }
console.log('artefacts →', OUT);
