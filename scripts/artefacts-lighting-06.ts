/**
 * Artefacts de l'éclairage visible (itération 06) : `npx tsx scripts/artefacts-lighting-06.ts` → artefacts/lighting-06/
 * Références : `git archive origin/hair-masses/artefacts shadow | tar -x -C <dossier>` puis `SHADOW_REFS=<dossier>/shadow` (défaut : /tmp/claude-0/shadowrefs/shadow).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../src';
import { ARCHETYPES, composeFigure, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel } from '../src/body/volume';
import { headLit, hostFace, LIGHT_PATTERNS, lightModelOf, litFigure, litHead, tonesOf, toLab, type LightModel, type LightPattern } from '../src/relief';
import { litStats, verifyLit } from '../src/verify';
import { BG, bodyHost } from './lib/body-host';
import { rasterPng } from './lib/raster';

const OUT = 'artefacts/lighting-06', REFS = process.env.SHADOW_REFS ?? '/tmp/claude-0/shadowrefs/shadow';
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x: number, y: number, t: string, s = 14, c = '#e8ecf5', a = 'middle'): string => `<text x="${x}" y="${y}" fill="${c}" font-family="DejaVu Sans" font-size="${s}" text-anchor="${a}">${esc(t)}</text>`;
const uri = (b: Buffer | string, mime = 'image/png'): string => `data:${mime};base64,${(typeof b === 'string' ? readFileSync(b) : b).toString('base64')}`;
const sheet = (name: string, w: number, h: number, body: string): void => writeFileSync(`${OUT}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`, { fonts: true, fitWidth: Math.min(2400, w) }));
const metrics: Record<string, unknown> = {};

// Hôte de la tête seule (grand), et hôte du corps (même visage n°11)
const faceObj = generateRandomFace(11, { id: 'f', transform: { x: 190, y: 250, scale: 0.9 } }), fo0 = faceObj.objects[0] as { material: { color: string }; face: { skin: { light: object } }; width: number; height: number };
// Les visages aléatoires IMPOSENT une teinte d'ombre (`skin.light.shadow`, proche de la couleur principale : cause du contraste de 5 %). Les artefacts cel/colorés utilisent le même visage SANS cette teinte imposée pour exercer la dérivation (ombre froide) ; la prise en compte d'une teinte imposée est testée à part.
const fo = { ...fo0, face: { ...fo0.face, skin: { ...fo0.face.skin, light: { ...fo0.face.skin.light, shadow: null } } } };
const scene = (light?: object): string => { const s = compileScene({ width: 380, height: 480, background: BG, objects: faceObj.objects, ...(light ? { light } : {}) } as never); if (!s.ok) throw new Error(s.issues.join()); return s.svg; };
const headPng = (svg: string, w = 380): Buffer => rasterPng(svg, { fitWidth: w });
const modelOf = (p: LightPattern): LightModel => lightModelOf({ azimuthDeg: p.azimuthDeg, elevationDeg: p.elevationDeg, shadowHardness: p.hardness, sourceSize: p.sourceSize }, { style: p.style, shadowHue: p.shadowHue, bias: p.bias });
const ratio = (svg: string): number => { const r = new Resvg(svg, { fitTo: { mode: 'width', value: 380 } }).render(), px = r.pixels, W = r.width, Hh = r.height; let l = 0, ln = 0, q = 0, qn = 0; for (let y = Math.floor(Hh * 0.3); y < Hh * 0.6; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (Math.abs(px[i]! - 0x3b) + Math.abs(px[i + 1]! - 0x41) + Math.abs(px[i + 2]! - 0x57) < 30) continue; const Y = 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!; if (x > W * 0.28 && x < W * 0.5) { l += Y; ln++; } else if (x >= W * 0.5 && x < W * 0.72) { q += Y; qn++; } } return l / ln / (q / qn); };
const cell = (img: Buffer, x: number, y: number, w: number, h: number, cap: string, sub = '', sub2 = ''): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="${uri(img)}"/>${T(x + w / 2, y - 8, cap, 14)}${sub ? T(x + w / 2, y + h + 16, sub, 12, '#aab4cc') : ''}${sub2 ? T(x + w / 2, y + h + 32, sub2, 12, '#aab4cc') : ''}`;
const AR = 480 / 380;

// 01 — diagnostic : AVANT (moteur de visage seul, lumière de la scène) / APRÈS (couche d'éclairage de la tête), 4 lumières
{ const L = [[270, 25, 1], [90, 25, 1], [330, 55, 0.5], [0, 60, 1]] as const, cw = 300, ch = 330, rows: string[] = [], diag: unknown[] = [];
  L.forEach(([az, el, hd], i) => {
    const spec = { azimuthDeg: az, elevationDeg: el, shadowHardness: hd, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, before = scene(spec), m = lightModelOf(spec, { style: 'soft' }), after = litHead(before, fo, fo.material.color, m).svg;
    const rb = ratio(before), ra = ratio(after); diag.push({ azimuth: az, elevation: el, ratioAvant: +rb.toFixed(3), ratioApres: +ra.toFixed(3) });
    rows.push(cell(headPng(before), 20 + i * (cw + 10), 60, cw, ch, `AVANT · lumière ${az}°/${el}°`, `luminance gauche/droite = ${rb.toFixed(3)}`), cell(headPng(after), 20 + i * (cw + 10), 60 + ch + 70, cw, ch, `APRÈS · même lumière`, `luminance gauche/droite = ${ra.toFixed(3)}`));
  });
  metrics.diagnostic = diag;
  sheet('01-diagnostic-avant-apres', 4 * (cw + 10) + 30, 2 * ch + 170, T(20, 30, 'Les ombres existaient mais ne se voyaient pas : avant, la lumière rasante n’écartait que de ~5 % la luminance gauche/droite du visage', 16, '#ffe9a8', 'start') + rows.join('')); }

// 02 — motifs d'éclairage lus sur les références (planches 01, 06, 09) + vérification
const pats: { id: string; stats: Record<string, number>; ok: boolean; failures: string[] }[] = [];
{ const cw = 280, ch = Math.round(280 * AR), host = faceObj, sc = scene(), rows: string[] = [];
  LIGHT_PATTERNS.forEach((p, i) => {
    const m = modelOf(p), r = litHead(sc, fo, fo.material.color, m, {}), v = verifyLit(r.lit, hostFace(fo).lm, hostFace(fo).nose, p), st = litStats(r.lit, hostFace(fo).lm);
    pats.push({ id: p.id, stats: Object.fromEntries(Object.entries(st).map(([k, x]) => [k, +x.toFixed(3)])), ok: v.ok, failures: v.failures.map((c) => c.id) });
    const col = i % 4, row = Math.floor(i / 4);
    rows.push(cell(headPng(r.svg, 380), 20 + col * (cw + 12), 70 + row * (ch + 80), cw, ch, `${p.label}`, `réf. ${p.ref}`, `${p.azimuthDeg}°/${p.elevationDeg}° · ${v.checks.length} contrôles ${v.ok ? '✔' : '✘'}`));
  });
  void host; metrics.motifs = pats;
  sheet('02-motifs-eclairage-tete', 4 * (cw + 12) + 30, 2 * (ch + 80) + 90, T(20, 30, 'Sept motifs d’éclairage (planches de référence 01, 06, 09) : même visage, seule la lumière change — ombre portée du nez, du sourcil, du menton sur le cou', 16, '#ffe9a8', 'start') + rows.join('')); }

// 03 — styles (peint / cel 2 tons / cel 3 tons) et lumières colorées (soleil, lune, bougie, store, feuillage)
{ const base = { azimuthDeg: 305, elevationDeg: 38 }, sc = scene(), items: [string, LightModel][] = [
    ['peint (soft) · 5200 K', lightModelOf({ ...base, shadowHardness: 0.5, sourceSize: 0.5, temperatureK: 5200 }, { style: 'soft' })],
    ['cel 2 tons · ombre froide', lightModelOf({ ...base, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel2', shadowHue: 'cool' })],
    ['cel 3 tons · cœur d’ombre', lightModelOf({ ...base, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel3', shadowHue: 'cool', bias: 0.1 })],
    ['lune · 9500 K, ombre bleue', lightModelOf({ azimuthDeg: 60, elevationDeg: 35, temperatureK: 9500, intensity: 0.8, shadowHardness: 0.7, sourceSize: 0.2 }, { style: 'soft', shadowHue: 'cool', ambient: '#5b6fb5', contrast: 1.2 })],
    ['bougie · 2200 K, par en dessous', lightModelOf({ azimuthDeg: 190, elevationDeg: 30, temperatureK: 2200, intensity: 0.9, shadowHardness: 0.4, sourceSize: 0.4 }, { style: 'soft', ambient: '#6a7db0', contrast: 1.3 })],
    ['contre-jour : rose / turquoise', lightModelOf({ azimuthDeg: 300, elevationDeg: 40, color: '#ffb4c8', shadowHardness: 0.8, sourceSize: 0.2 }, { style: 'cel2', shadowHue: 'cool', ambient: '#7fe0d0', rimColor: '#7fe8e0', rim: 0.9 })],
    ['store (projection en bandes)', lightModelOf({ ...base, shadowHardness: 0.9, sourceSize: 0.1 }, { style: 'soft', gobo: { kind: 'blinds', scale: 38, angleDeg: 60, duty: 0.45 } })],
    ['feuillage (taches de lumière)', lightModelOf({ ...base, shadowHardness: 0.8, sourceSize: 0.2, temperatureK: 4800 }, { style: 'soft', gobo: { kind: 'dapple', scale: 34, angleDeg: 0, duty: 0.42 } })]];
  const cw = 280, ch = Math.round(280 * AR), rows = items.map(([cap, m], i) => { const r = litHead(sc, fo, fo.material.color, m, {}), t = tonesOf(fo.material.color, m); return cell(headPng(r.svg), 20 + (i % 4) * (cw + 12), 70 + Math.floor(i / 4) * (ch + 80), cw, ch, cap, `ΔL OKLab = ${(toLab(t.lit).L - toLab(t.shadow).L).toFixed(2)}`); });
  sheet('03-styles-et-lumieres-colorees', 4 * (cw + 12) + 30, 2 * (ch + 80) + 90, T(20, 30, 'Styles (réf. 01, 03, 06, 08) et lumières colorées (réf. 04, 05, 10) : un seul modèle de lumière pour la peau, les yeux et les cheveux', 16, '#ffe9a8', 'start') + rows.join('')); }

// 04 / 05 — corps entier AVEC la tête : ancien éclairage | peint | cel ; puis quatre lumières
const BH = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {});
const crop = (svg: string, y1: number): string => svg.replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `viewBox="0 -75 380 ${y1 + 75}" width="380" height="${y1 + 75}"`).replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="${y1 + 75}" fill="${BG}"/>`);
const figPng = (m: LightModel | null, uid: string, hp = 1100): { png: Buffer; ar: number; ms: number } => { const t0 = Date.now(); let svg: string, y1: number;
  if (m) { const f = litFigure(BH.svg, BH.o, BH.skin, set, m, { heightPx: hp, uid }); svg = f.svg; y1 = Math.ceil(62 + 0.27 * f.body.bounds.y1 + 12); } else { const b = renderVolumesPixel(set, { skin: BH.skin, heightPx: hp, uid, lightModel: null }); svg = composeFigure(BH.svg, { back: b.svg, front: '' } as never); y1 = Math.ceil(62 + 0.27 * b.bounds.y1 + 12); }
  return { png: rasterPng(crop(svg, y1), { fitWidth: 560 }), ar: (y1 + 75) / 380, ms: Date.now() - t0 }; };
{ const items: [string, LightModel | null][] = [['ANCIEN éclairage (avant)', null], ['APRÈS · peint, 305°/38°', lightModelOf({ azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' })], ['APRÈS · cel 3 tons, 305°/38°', lightModelOf({ azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel3', shadowHue: 'cool', bias: 0.1 })]];
  const cw = 440, rows: string[] = [], timing: Record<string, number> = {}; let hh = 0;
  items.forEach(([cap, m], i) => { const f = figPng(m, `a${i}`), h = cw * f.ar; hh = Math.max(hh, h); timing[cap] = f.ms; rows.push(`<image x="${20 + i * (cw + 10)}" y="60" width="${cw}" height="${h}" href="${uri(f.png)}"/>${T(20 + i * (cw + 10) + cw / 2, 50, cap, 15)}`); });
  metrics.tempsRenduFigureMs = timing; sheet('04-corps-et-tete-avant-apres', 3 * (cw + 10) + 30, hh + 80, rows.join('')); }
{ const L: [string, LightModel][] = [['270° / 25° (latérale gauche)', lightModelOf({ azimuthDeg: 270, elevationDeg: 25, shadowHardness: 0.7, sourceSize: 0.3 }, { style: 'soft' })], ['305° / 38° (trois-quarts)', lightModelOf({ azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.7, sourceSize: 0.3 }, { style: 'soft' })], ['0° / 45° (zénithale)', lightModelOf({ azimuthDeg: 0, elevationDeg: 45, shadowHardness: 0.7, sourceSize: 0.3 }, { style: 'soft' })], ['60° / 30° (droite, chaude)', lightModelOf({ azimuthDeg: 60, elevationDeg: 30, shadowHardness: 0.7, sourceSize: 0.3, temperatureK: 4200 }, { style: 'soft' })]];
  const cw = 330, rows: string[] = []; let hh = 0; L.forEach(([cap, m], i) => { const f = figPng(m, `b${i}`, 900), h = cw * f.ar; hh = Math.max(hh, h); rows.push(`<image x="${20 + i * (cw + 10)}" y="60" width="${cw}" height="${h}" href="${uri(f.png)}"/>${T(20 + i * (cw + 10) + cw / 2, 50, cap, 14)}`); });
  sheet('05-corps-quatre-lumieres', 4 * (cw + 10) + 30, hh + 80, rows.join('')); }

// 06 — extraction : références et mesures
{ const st = JSON.parse(readFileSync('references/shadow/lighting-stats.json', 'utf8')) as { planches: Record<string, { dL_oklab: number; ton_lumiere_rgb: number[]; ton_ombre_rgb: number[] }>; palettes_peintes: Record<string, { dL_lumiere_moins_ombre: number; rgb: number[][] } | null> };
  const names = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'], tw = 230, rows: string[] = [];
  names.forEach((n, i) => { const x = 20 + (i % 5) * (tw + 12), y = 50 + Math.floor(i / 5) * 400, p = st.palettes_peintes[n], f = st.planches[n]; rows.push(`<image x="${x}" y="${y}" width="${tw}" height="300" preserveAspectRatio="xMidYMid meet" href="${uri(`${REFS}/${n}.jpg`, 'image/jpeg')}"/>${T(x + tw / 2, y - 6, `réf. ${n}`, 14)}`);
    const chips = p ? p.rgb : f ? [f.ton_ombre_rgb, f.ton_lumiere_rgb] : [], d = p ? p.dL_lumiere_moins_ombre : f?.dL_oklab;
    chips.forEach((c, j) => rows.push(`<rect x="${x + j * 46}" y="${y + 310}" width="42" height="26" fill="rgb(${c.join(',')})" stroke="#fff" stroke-opacity=".4"/>`));
    rows.push(T(x, y + 358, d === undefined ? 'non mesuré (motifs lus à l’œil)' : `ΔL OKLab lumière − ombre = ${d.toFixed(2)}`, 12, '#ffe9a8', 'start')); });
  metrics.referencesDeltaL = { cel: { '01': st.planches['01']?.dL_oklab, '06': st.planches['06']?.dL_oklab }, peint: Object.fromEntries(Object.entries(st.palettes_peintes).map(([k, v]) => [k, v?.dL_lumiere_moins_ombre])) };
  sheet('06-extraction-references', 5 * (tw + 12) + 30, 2 * 400 + 40, T(20, 28, 'Dix références : tons ombre (gauche) → lumière (droite) mesurés ; ΔL OKLab peint 0,40–0,50, cel 0,21–0,30', 16, '#ffe9a8', 'start') + rows.join('')); }

// 07 — références (planche 01) contre le moteur, même lumière
{ const sc = scene(), cells: [number, number, number, number, string][] = [[1, 0, 270, 18, 'n°4 — de la gauche'], [0, 2, 90, 18, 'n°3 — de la droite'], [1, 1, 0, 50, 'n°5 — d’en haut'], [2, 0, 180, 18, 'n°7 — d’en bas'], [0, 0, 305, 38, 'n°1 — gauche, haute']];
  const cw = 250, rows: string[] = [];
  cells.forEach(([r, c, az, el, cap], i) => { const m = lightModelOf({ azimuthDeg: az, elevationDeg: el, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel2', shadowHue: 'cool', bias: el < 20 ? (az === 180 ? 0.36 : 0.1) : el > 45 ? 0.2 : 0.1 });
    const eng = headPng(litHead(sc, fo, fo.material.color, m, {}).svg), refCrop = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c * 400} ${r * 400} 400 400" width="400" height="400"><image width="1200" height="1200" href="${uri(`${REFS}/01.jpg`, 'image/jpeg')}"/></svg>`).render().asPng();
    rows.push(cell(refCrop, 20 + i * (cw + 8), 60, cw, cw, `réf. 01 ${cap}`), cell(eng, 20 + i * (cw + 8), 60 + cw + 56, cw, cw * AR, `moteur ${az}°/${el}°`)); });
  sheet('07-reference-vs-moteur', 5 * (cw + 8) + 30, cw + cw * AR + 150, T(20, 30, 'Planche de référence 01 (haut) et moteur (bas), même direction de lumière : terminateur, ombre du nez, ombre sous le menton', 16, '#ffe9a8', 'start') + rows.join('')); }

// 08 — vérification (3 couches) : liste des contrôles du motif « trois-quarts droite »
{ const fc = hostFace(fo), p = LIGHT_PATTERNS.find((q) => q.id === 'three-quarter-right')!, r = headLit(fc.p, fc.lm, fc.nose, fo.material.color, modelOf(p)), v = verifyLit(r, fc.lm, fc.nose, p), rows: string[] = [];
  v.checks.forEach((c, j) => rows.push(T(20, 70 + j * 22, `${c.ok ? '✔' : '✘'} [${c.layer}] ${c.id.replace('lit.', '')} — ${c.detail.slice(0, 170)}`, 12, c.ok ? '#bfe8c4' : '#ff8a8a', 'start')));
  metrics.verification = { motif: p.id, ok: v.ok, controles: v.checks.length };
  sheet('08-verification', 1500, 100 + v.checks.length * 22, T(20, 34, `Vérification de l’éclairage (géométrie · anatomie · style), motif « ${p.label} » : ${v.ok ? 'aucun échec' : 'ÉCHECS'} (${v.checks.length} contrôles)`, 16, '#ffe9a8', 'start') + rows.join('')); }
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log('artefacts →', OUT);
