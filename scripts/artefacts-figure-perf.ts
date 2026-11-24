/**
 * `npx tsx scripts/artefacts-figure-perf.ts` — preuves visuelles de docs/PERF-4.md dans artefacts/figure-perf/.
 * L'« ancien code » est un worktree git de l'état d'origine (`git worktree add /tmp/orig ddbbad4`, node_modules lié) : mêmes figures, rendues par l'ancien et le nouveau moteur.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { compileScene, generateRandomFace } from '../src';
import { encodePngRgba } from '../src/core/png';
import { cullOffCanvas } from '../src/core/offcanvas';
import { clearLayerCaches } from '../src/perf';
import { lightModelOf, litFigure, type LitStyle } from '../src/relief';
import { figureEquivalence } from '../src/verify/figure-equivalence';
import { bodyHost } from './lib/body-host';

const OUT = 'artefacts/figure-perf'; mkdirSync(OUT, { recursive: true });
interface R { w: number; h: number; d: Uint8Array }
const ras = (svg: string, w: number): R => { const r = new Resvg(cullOffCanvas(svg).svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: w } }).render(); return { w: r.width, h: r.height, d: new Uint8Array(r.pixels) }; };
const b64 = (r: R): string => encodePngRgba(r.w, r.h, new Uint8ClampedArray(r.d)).toString('base64');
const BG = '#f1ede6', esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x: number, y: number, s: string, sz = 15, w = 500, c = '#222'): string => `<text x="${x}" y="${y}" font-family="Inter, Open Sans, sans-serif" font-size="${sz}" font-weight="${w}" fill="${c}">${esc(s)}</text>`;
function montage(file: string, title: string, panels: { r: R; label: string }[], cols: number, cw: number, sub = ''): void {
  const ch = Math.max(...panels.map((p) => Math.round((p.r.h * cw) / p.r.w))), rows = Math.ceil(panels.length / cols), W = cols * (cw + 16) + 16, H = 64 + rows * (ch + 40) + 8;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/>${T(16, 28, title, 19, 700)}${T(16, 50, sub, 13, 400, '#555')}`;
  panels.forEach((p, i) => { const x = 16 + (i % cols) * (cw + 16), y = 64 + Math.floor(i / cols) * (ch + 40), h = Math.round((p.r.h * cw) / p.r.w); s += `<image x="${x}" y="${y}" width="${cw}" height="${h}" href="data:image/png;base64,${b64(p.r)}"/>${T(x, y + ch + 22, p.label, 13.5)}`; });
  writeFileSync(`${OUT}/${file}`, new Resvg(`${s}</svg>`, { font: { loadSystemFonts: true } }).render().asPng());
}
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1]!;
const crop = (r: R, y0: number, y1: number): R => ({ w: r.w, h: y1 - y0, d: r.d.slice(y0 * r.w * 4, y1 * r.w * 4) });
const absdiff = (a: R, b: R, k: number): { r: R; n: number } => { const d = new Uint8Array(a.d.length); let n = 0; for (let i = 0; i < a.d.length; i += 4) { let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.d[i + c]! - b.d[i + c]!)); if (m) n++; d[i] = d[i + 1] = d[i + 2] = Math.min(255, m * k); d[i + 3] = 255; } return { r: { w: a.w, h: a.h, d }, n }; };
const M = (az: number, el = 38, extra: Record<string, number> = {}, style: LitStyle = 'soft') => lightModelOf({ azimuthDeg: az, elevationDeg: el, shadowHardness: 0.5, sourceSize: 0.4, ...extra }, { style });
const summary: Record<string, unknown> = {};

// ── 1. AVANT / APRÈS : même figure, ancien code vs nouveau code ───────────────────────────────────────────────
{
  const O = { host: await import('/tmp/orig/scripts/lib/body-host'), body: await import('/tmp/orig/src/body'), vol: await import('/tmp/orig/src/body/volume'), rel: await import('/tmp/orig/src/relief') };
  const oh = O.host.bodyHost(), os = O.vol.bodyVolumes(O.body.ARCHETYPES.veryMuscular, oh.a, {}), nh = bodyHost(), ns = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, nh.a, {});
  const om = O.rel.lightModelOf({ azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' }), nm = M(305);
  const run = (f: () => unknown): number => { const t = performance.now(); f(); return performance.now() - t; };
  const oldMs = med([0, 1, 2].map(() => run(() => O.rel.litFigure(oh.svg, oh.o, oh.skin, os, om, { heightPx: 1100 }))));
  const newMs = med([0, 1, 2].map(() => { clearLayerCaches(); return run(() => litFigure(nh.svg, nh.o, nh.skin, ns, nm, { heightPx: 1100 })); }));
  clearLayerCaches(); litFigure(nh.svg, nh.o, nh.skin, ns, nm, { heightPx: 1100 });
  const lightMs = med([20, 90, 160].map((az) => run(() => litFigure(nh.svg, nh.o, nh.skin, ns, M(az), { heightPx: 1100 }))));
  const a = ras(O.rel.litFigure(oh.svg, oh.o, oh.skin, os, om, { heightPx: 1100 }).svg, 640), b = ras(litFigure(nh.svg, nh.o, nh.skin, ns, nm, { heightPx: 1100 }).svg, 640), d = absdiff(a, b, 16);
  montage('01-avant-apres-identiques.png', 'Même figure, ancien moteur vs nouveau : identiques pixel pour pixel', [{ r: a, label: `ancien — ${oldMs.toFixed(0)} ms (1 100 px, à froid)` }, { r: b, label: `nouveau — ${newMs.toFixed(0)} ms (froid) · ${lightMs.toFixed(0)} ms (lumière seule)` }, { r: d.r, label: `diff ×16 : ${d.n} px différent(s) / ${a.w * a.h}` }], 3, 360, 'figure complète (tête, cou, corps éclairés), très musclé, lumière 305°/38°, rendu 1 100 px puis rastérisé à 640 px');
  Object.assign(summary, { ancienColdMs: +oldMs.toFixed(0), nouveauColdMs: +newMs.toFixed(0), nouveauLumiereSeuleMs: +lightMs.toFixed(0), pixelsDifferents: d.n, pixelsTotal: a.w * a.h });
}

// ── 2. BALAYAGE DE LUMIÈRES (les couches indépendantes de la lumière sont réutilisées) ───────────────────────────────
const BH = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {});
{
  clearLayerCaches(); const ps: { r: R; label: string }[] = [];
  for (const az of [305, 20, 90, 160, 230, 270]) { const t = performance.now(); const f = litFigure(BH.svg, BH.o, BH.skin, set, M(az), { heightPx: 1100 }); ps.push({ r: ras(f.svg, 420), label: `azimut ${az}° — ${(performance.now() - t).toFixed(0)} ms${ps.length ? ' (couches réutilisées)' : ' (à froid)'}` }); }
  montage('02-balayage-lumiere.png', 'Balayage de 6 lumières : relief, AO, G-buffer, occlusion calculés une seule fois', ps, 3, 300, 'seules l’ombre portée, l’ombrage et le PNG sont refaits à chaque lumière');
}

// ── 3. TÊTE : ombre sur grille pleine (exacte) vs ×2, avec la vérification géométrie / anatomie / style ───────────────────
{
  const ref = litFigure(BH.svg, BH.o, BH.skin, set, M(305), { heightPx: 700 }), opt = litFigure(BH.svg, BH.o, BH.skin, set, M(305), { heightPx: 700, headCastScale: 2 });
  const A = ras(ref.svg, 1400), B = ras(opt.svg, 1400), hh = Math.round(A.h * 0.3), ca = crop(A, 0, hh), cb = crop(B, 0, hh), d = absdiff(ca, cb, 10);
  const asRaster = (r: R) => ({ width: r.w, height: r.h, data: r.d }), v = figureEquivalence(ref, opt, asRaster(ras(ref.svg, 560)), asRaster(ras(opt.svg, 560))), bad = v.checks.filter((c) => !c.ok).length;
  montage('03-tete-ombre-x1-x2-verification.png', `Ombre de la tête : grille pleine vs ×2 — ${v.checks.length} vérifications, ${bad} échec`, [{ r: ca, label: 'exact (headCastScale 1, défaut)' }, { r: cb, label: 'headCastScale 2 (≈ 4× moins de calcul)' }, { r: d.r, label: 'différence ×10 (bord de pénombre seulement)' }], 3, 440, `géométrie : relief identique · contours ${v.metrics.edgeCorrelation.toFixed(4)} · silhouette ${v.metrics.silhouetteIoU.toFixed(5)} · traits sombres ${v.metrics.darkFeatureIoU.toFixed(4)} · couleur moyenne ${v.metrics.meanColorShift.toFixed(3)}`);
  Object.assign(summary, { verificationsTete: v.checks.length, echecsTete: bad });
}

// ── 4. PARAMÈTRES CONSOMMÉS : un paramètre à la fois, par rapport à la base ──────────────────────────────────────────
{
  const mk = (m = M(305), skin = BH.skin, o: object = {}) => ras(litFigure(BH.svg, BH.o, skin, set, m, { heightPx: 520, ...o }).svg, 300);
  const V: [string, R][] = [['base (305°, 38°, soft)', mk()], ['azimut 60°', mk(M(60))], ['élévation 70°', mk(M(305, 70))], ['dureté d’ombre 0,95', mk(M(305, 38, { shadowHardness: 0.95 }))], ['style cel3', mk(M(305, 38, {}, 'cel3'))], ['peau foncée (corps + teintes ; le visage garde la peau de la scène)', mk(M(305), '#6b4226')], ['ao 0,9 (corps)', mk(M(305), BH.skin, { ao: 0.9 })], ['rainures 1,0 (corps)', mk(M(305), BH.skin, { groove: 1 })], ['caméra yaw 25°', mk(M(305), BH.skin, { camera: { yaw: 25, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } })]];
  montage('04-parametres-consommes.png', 'Chaque paramètre de la figure agit, et là où il doit', V.map(([label, r]) => ({ r, label })), 3, 250, 'ao / rainures : le corps seul ; lumière, style, peau : tête et corps ; caméra : le corps (la tête de face ne tourne pas)');
}

// ── 5. SCÈNE À PLUSIEURS PERSONNAGES, dont un hors cadre (plantage natif de resvg avant la garde) ───────────────────────
{
  const xs = [140, 400, 660, 9000], objs: unknown[] = [];
  xs.forEach((x, i) => { const f = generateRandomFace(3 + 8 * i, { id: `f${i}`, transform: { x, y: 150, scale: 0.34 } }); objs.push(...f.objects, { kind: 'body', id: `b${i}`, host: `f${i}`, body: { age: 24 + 4 * i, sex: i % 2, muscularity: 0.45 }, legs: {} }); });
  const r = compileScene({ width: 800, height: 780, background: BG, objects: objs } as never);
  if (r.ok) { const g = cullOffCanvas(r.svg); montage('05-scene-4-personnages-garde-hors-cadre.png', '4 personnages, le 4e à x = 9 000 (hors cadre) : rendu sans plantage', [{ r: ras(r.svg, 780), label: `garde : ${g.culled} calques invisibles retirés (${(r.svg.length / 1024).toFixed(0)} → ${(g.svg.length / 1024).toFixed(0)} Ko) ; sans elle, resvg avorte le processus` }], 1, 780, 'les 3 personnages visibles sont inchangés (tests/offcanvas.test.ts : pixels identiques)'); summary['calquesRetires'] = g.culled; }
}

// ── 6. TEMPS ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const s = summary as Record<string, number>, rows: [string, number, string][] = [['ancien moteur, à froid', s['ancienColdMs']!, '#b8503a'], ['nouveau, à froid', s['nouveauColdMs']!, '#3a7ab8'], ['nouveau, seule la lumière change', s['nouveauLumiereSeuleMs']!, '#2f9a6b']], mx = Math.max(...rows.map((r) => r[1]));
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${90 + rows.length * 56}"><rect width="840" height="${90 + rows.length * 56}" fill="${BG}"/>${T(16, 30, 'Figure complète à 1 100 px — temps de calcul (ms, médiane de 3)', 18, 700)}`;
  rows.forEach(([l, v, c], i) => { const y = 56 + i * 56; g += `${T(16, y + 14, l, 14)}<rect x="260" y="${y}" width="${Math.round((v / mx) * 440)}" height="26" rx="3" fill="${c}"/>${T(266 + Math.round((v / mx) * 440), y + 19, `${v} ms`, 14, 700)}`; });
  writeFileSync(`${OUT}/06-temps.png`, new Resvg(`${g}</svg>`, { font: { loadSystemFonts: true } }).render().asPng());
}
writeFileSync(`${OUT}/mesures.json`, `${JSON.stringify(summary, null, 2)}\n`); console.log(JSON.stringify(summary));
