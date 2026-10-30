/** Artefacts du bas du corps : planches PNG + rapport de vérification + mesures de temps. `npx tsx scripts/artefacts-lower.ts` → artefacts/body-lower/ */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { ARCHETYPES, anchorFromFace, composeFigure, figureBounds, figureMarkup, legGeometry, tierName, tierOf, bodyGeometry, type BodyInput } from '../src/body';
import { verifyLegs } from '../src/verify';
import { rasterPng } from './lib/raster';

const OUT = 'artefacts/body-lower';
mkdirSync(OUT, { recursive: true });
const CW = 380, CH = 920, S = 0.27, BG = '#3b4157';
type Legs = Parameters<typeof figureMarkup>[1];
const face = (seed: number) => { const f = generateRandomFace(seed, { id: 'f', transform: { x: CW / 2, y: 62, scale: S } }); const o = f.objects[0] as any; const sc = compileScene({ width: CW, height: CH, background: BG, objects: f.objects }); if (!sc.ok) throw new Error(sc.issues.join()); return { o, svg: sc.svg }; };
const fig = (body: BodyInput, legs: Legs, seed: number, mode?: 'atoms', level?: 0 | 1 | 2 | 3) => {
  const { o, svg } = face(seed), a = anchorFromFace(o.face, o.width, o.height);
  const m = figureMarkup(body, legs, a, { skin: o.material.color, uid: 'b', ...(mode ? { mode } : {}), ...(level !== undefined ? { level } : {}) });
  return { inner: composeFigure(svg, m).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''), a, o };
};
const label = (x: number, y: number, t: string, s = 15): string => `<text x="${x}" y="${y}" fill="#e8ecf5" font-family="sans-serif" font-size="${s}" text-anchor="middle">${t}</text>`;
const sheet = (name: string, cols: string[], cw = CW, ch = CH): void => { const W = cw * cols.length; writeFileSync(`${OUT}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${ch}" width="${W}" height="${ch}"><rect width="${W}" height="${ch}" fill="${BG}"/>${cols.join('')}</svg>`, { fonts: true })); };
const cell = (i: number, inner: string, cap: string, vb = `0 0 ${CW} ${CH}`, cw = CW, ch = CH): string => `<svg x="${i * cw}" y="0" width="${cw}" height="${ch}" viewBox="${vb}">${inner}</svg>${label(i * cw + cw / 2, ch - 12, cap)}`;
/** Cellule rognée : rastérisée SÉPARÉMENT avec un viewBox racine puis incrustée (resvg 0.4x panique sur un clipPath hors cadre en viewBox imbriqué). */
const zoomCell = (i: number, inner: string, vb: string, cap: string): string => {
  const [, , w, h] = vb.split(' ').map(Number) as [number, number, number, number];
  const png = rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${CW}" height="${Math.round((CW * h) / w)}"><rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="${BG}"/>${inner}</svg>`);
  return `<image x="${i * CW}" y="0" width="${CW}" height="${Math.round((CW * h) / w)}" href="data:image/png;base64,${png.toString('base64')}"/>${label(i * CW + CW / 2, CH - 12, cap)}`;
};
const names = Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[];

// 01 — 13 archétypes (2 planches)
sheet('01a-archetypes-1', names.slice(0, 7).map((n, i) => cell(i, fig(ARCHETYPES[n] as BodyInput, {}, 11).inner, n)));
sheet('01b-archetypes-2', names.slice(7).map((n, i) => cell(i, fig(ARCHETYPES[n] as BodyInput, {}, 11).inner, n)));
// 02 — hiérarchie musculaire 0 → 5, homme puis femme
const mus = [0, 0.2, 0.4, 0.6, 0.8, 1];
for (const [tag, sex] of [['homme', 1], ['femme', -1]] as const)
  sheet(`02-hierarchie-musculaire-${tag}`, mus.map((m, i) => { const bp = { age: 28, sex, adiposity: 0.08, muscularity: m }, t = tierOf(bodyGeometry(bp, anchorFromFace(face(11).o.face, face(11).o.width, face(11).o.height)).frame.vis); return cell(i, fig(bp, {}, 11).inner, `palier ${t.toFixed(1)} · ${tierName(t)}`); }));
// 03 — poses des jambes
const poses: [string, Legs][] = [['jambes jointes', { pose: { left: { abduction: 0, footTurnout: 5 }, right: { abduction: 0, footTurnout: 5 } } }], ['écart 18°', { pose: { left: { abduction: 18, footTurnout: 25 }, right: { abduction: 18, footTurnout: 25 } } }], ['genou G fléchi 50°', { pose: { left: { kneeFlex: 50, abduction: 8 }, right: { abduction: 3 } } }], ['pieds en dedans, orteils serrés', { pose: { left: { footTurnout: -10, toeSpread: 0 }, right: { footTurnout: -10, toeSpread: 0 } } }], ['orteils écartés / crispés', { pose: { left: { toeSpread: 1, footTurnout: 20 }, right: { toeCurl: 0.9 } } }]];
sheet('03-poses-jambes', poses.map(([n, l], i) => cell(i, fig(ARCHETYPES.muscular as BodyInput, l, 11).inner, n)));
// 04 — zoom des jambes basses et des pieds (3 morphologies) : le cadre suit le sol de CHAQUE figure
const A1 = (() => { const { o } = face(11); return anchorFromFace(o.face, o.width, o.height); })();
sheet('04-pieds-et-genoux', (['thin', 'muscular', 'obese'] as const).map((n, i) => { const sole = legGeometry(ARCHETYPES[n] as BodyInput, {}, A1).frame.y.sole, vh = 363; return zoomCell(i, fig(ARCHETYPES[n] as BodyInput, {}, 11).inner, `${CW / 2 - 75} ${62 + S * sole - vh + 40} 150 ${vh}`, `${n} · genou → pieds`); }));
// 05 — atomes (mode diagnostic) et niveaux de présentation
sheet('05-atomes', ['adultMale', 'adultFemale', 'elderMale'].map((n, i) => cell(i, fig(ARCHETYPES[n as keyof typeof ARCHETYPES] as BodyInput, {}, 11, 'atoms').inner, `${n} · atomes`)));
sheet('06-niveaux-presentation', ([0, 1, 2, 3] as const).map((l, i) => cell(i, fig(ARCHETYPES.muscular as BodyInput, {}, 11, undefined, l).inner, `niveau ${l}`)));
// 07 — comparaison aux références
const b64 = (f: string): string => `data:image/jpeg;base64,${readFileSync(`references/anatomy/${f}`).toString('base64')}`;
const refs: [string, string, BodyInput][] = [['ref-02-homme-muscles-colores.jpg', 'ref-02 ↔ veryMuscular', ARCHETYPES.veryMuscular as BodyInput], ['ref-04-homme-ecorche-profil-face.jpg', 'ref-04 ↔ muscular', ARCHETYPES.muscular as BodyInput], ['ref-01-femme-zbrush-3vues.jpg', 'ref-01 ↔ adultFemale', ARCHETYPES.adultFemale as BodyInput]];
sheet('07-comparaison-references', refs.flatMap(([f, cap, b], i) => [`<image x="${i * 2 * CW + 10}" y="40" width="${CW - 20}" height="${CH - 100}" href="${b64(f)}" preserveAspectRatio="xMidYMid meet"/>`, cell(i * 2 + 1, fig(b, {}, 11).inner, cap)]), CW, CH);
// 08 — tête complète + haut du corps (zoom)
sheet('08-tete-complete', ([['muscular', 11], ['adultFemale', 23], ['elderMale', 5], ['child', 7]] as const).map(([n, s], i) => zoomCell(i, fig(ARCHETYPES[n] as BodyInput, {}, s).inner, `${CW / 2 - 100} 0 200 484`, `${n} · seed ${s}`)));

// Rapport de vérification + temps
const report: Record<string, unknown> = {}; const A0 = (() => { const { o } = face(11); return anchorFromFace(o.face, o.width, o.height); })();
for (const n of names) { const g = legGeometry(ARCHETYPES[n] as BodyInput, {}, A0), r = verifyLegs(g, figureMarkup(ARCHETYPES[n] as BodyInput, {}, A0, { skin: '#c99a76' })); report[n] = { ok: r.ok, checks: r.checks.length, failures: r.failures.map((c) => c.id), warnings: r.warnings.map((c) => c.id), measures: g.measures, atoms: g.atoms.length }; }
const t = (fn: () => void, n: number): number => { const s = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - s) / n; };
const geoCold = t(() => { const k = Math.random(); legGeometry({ age: 28, sex: 1, adiposity: 0.2 + k * 0.01, muscularity: 0.5 }, {}, A0); }, 40);
const svgCold = t(() => { const k = Math.random(); figureMarkup({ age: 28, sex: 1, adiposity: 0.2 + k * 0.01, muscularity: 0.5 }, {}, A0, { skin: '#c99a76' }); }, 40);
const warm = t(() => figureMarkup(ARCHETYPES.muscular as BodyInput, {}, A0, { skin: '#c99a76' }), 200);
const full = figureMarkup(ARCHETYPES.muscular as BodyInput, {}, A0, { skin: '#c99a76' });
const bb = figureBounds(legGeometry(ARCHETYPES.muscular as BodyInput, {}, A0)), rw = 380, rh = Math.round((rw * (bb.y1 - bb.y0)) / (bb.x1 - bb.x0));
let rk = 0;
const rst = t(() => { rk++; rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bb.x0} ${bb.y0} ${bb.x1 - bb.x0} ${bb.y1 - bb.y0}" width="${rw}" height="${rh}"><!--${rk}${Math.random()}-->${full.back}${full.front}</svg>`, { fonts: false }); }, 10);
writeFileSync(`${OUT}/rapport.json`, JSON.stringify({ archetypes: report, timingsMs: { geometryColdLegs: +geoCold.toFixed(2), figureSvgCold: +svgCold.toFixed(2), figureSvgWarmCache: +warm.toFixed(4), rasterFigureSansTete380px: +rst.toFixed(1), svgBytes: full.back.length + full.front.length } }, null, 1));
console.log(JSON.stringify((JSON.parse(readFileSync(`${OUT}/rapport.json`, 'utf8')) as any).timingsMs));
