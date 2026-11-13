import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ALMOND_REF, NEUTRAL_REF, REF_PROFILE, openingGeometry, openingProfile } from '../src/geometry/eye';
import { EXTRA_EYE_COUNT, distinctness, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';
import { verifyEye } from '../src/verify/eye';
import { layout, render } from './lib/proof';
import { eyeSheetPng } from './lib/eye-sheet';
import { BASE, SWEEPS, sweepResult, withPath } from './lib/eye-param-sweeps';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts (preuves visuelles) de la tâche « moteur d'yeux nourri par les références » : `npx tsx scripts/artefacts-eyes-100.ts` -> artefacts/eyes-100/.
 *   02 almond avant / après vs références (profils + rendus)   03 balayage des paramètres (valeur basse | haute, pixels changés)
 *   04 têtes complètes (une enveloppe par tête)               05 gros plans de têtes   06 rapport de vérification (JSON)
 * (01 = scripts/gallery-eyes-100.ts)
 */
const OUT = 'artefacts/eyes-100';
mkdirSync(OUT, { recursive: true });
const b64 = (p: string): string => readFileSync(p).toString('base64');
const png = (name: string, buf: Buffer): void => { writeFileSync(`${OUT}/${name}`, buf); console.log(`${OUT}/${name}`); };

// ---- 02 : almond avant / après -------------------------------------------------------------------------------------------------------------------------
const norm = (v: readonly number[]): number[] => { const m = Math.max(...v.map(Math.abs)) || 1; return v.map((x) => x / m); };
const prof = () => openingProfile(openingGeometry(Shape.parse({ style: 'almond' }), Canthi.parse({})));
const saved = { ...ALMOND_REF };
Object.assign(ALMOND_REF, NEUTRAL_REF); // l'ancien almond = facteurs neutres (la formule d'origine)
const oldP = prof();
const oldPng = eyeSheetPng([{ label: '', eye: { eyebrow: null, pupil: { size: 0.34 } } }], 1, 420, 250, false);
Object.assign(ALMOND_REF, saved);
const newP = prof();
const newPng = eyeSheetPng([{ label: '', eye: { eyebrow: null, pupil: { size: 0.34 } } }], 1, 420, 250, false);
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { upperProfile: number[]; lowerProfile: number[] }>;
const X = (i: number): number => 40 + (i / 20) * 360;
const line = (v: readonly number[], yBase: number, sign: number, col: string, w = 1.5, dash = ''): string => `<polyline fill="none" stroke="${col}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} points="${v.map((y, i) => `${X(i)},${yBase + sign * y * 120}`).join(' ')}"/>`;
const rc = (k: string, col: string): string => line(norm(M[k]!.upperProfile), 170, -1, col, 1) + line(norm(M[k]!.lowerProfile), 190, 1, col, 1);
const plot = `<g>${rc('04', '#9aa4c8')}${rc('07', '#8fb59a')}${rc('11', '#c8a58f')}
${line(REF_PROFILE.upper, 170, -1, '#fff', 2.5, '6 4')}${line(REF_PROFILE.lower, 190, 1, '#fff', 2.5, '6 4')}
${line(norm(oldP.upper), 170, -1, '#ff6b6b', 2)}${line(norm(oldP.lower), 190, 1, '#ff6b6b', 2)}
${line(norm(newP.upper), 170, -1, '#4ade80', 2.5)}${line(norm(newP.lower), 190, 1, '#4ade80', 2.5)}
<text x="40" y="22" fill="#cfd6ee" font-size="13" font-family="DejaVu Sans">Profils haut / bas normalisés (axe des canthi, 0 = interne)</text>
<text x="40" y="335" fill="#9aa4c8" font-size="12" font-family="DejaVu Sans">réfs 04 / 07 / 11 (fins) · moyenne mesurée (blanc pointillé)</text>
<text x="40" y="352" fill="#ff6b6b" font-size="12" font-family="DejaVu Sans">avant : creux bas ${oldP.lowerPeakAt}, canthus interne ${oldP.canthusAngleDeg.inner.toFixed(0)}°</text>
<text x="40" y="369" fill="#4ade80" font-size="12" font-family="DejaVu Sans">après : creux bas ${newP.lowerPeakAt}, canthus interne ${newP.canthusAngleDeg.inner.toFixed(0)}° (références : 0,46–0,62)</text></g>`;
const img = (png_: Buffer, x: number, y: number, w: number, h: number): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${png_.toString('base64')}"/>`;
const refImg = (k: string, x: number, y: number): string => `<image x="${x}" y="${y}" width="420" height="250" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${b64(`artefacts/eyes-refs/overlay-${k}.png`)}"/>`;
const fig2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="580"><rect width="1740" height="580" fill="#20243a"/>
<g transform="translate(0,0)">${plot}</g>
${img(oldPng, 450, 10, 420, 250)}<text x="460" y="272" fill="#ff6b6b" font-size="13" font-family="DejaVu Sans">almond AVANT</text>
${img(newPng, 880, 10, 420, 250)}<text x="890" y="272" fill="#4ade80" font-size="13" font-family="DejaVu Sans">almond APRÈS (mesuré)</text>
${refImg('04', 450, 290)}${refImg('07', 880, 290)}${refImg('11', 1310, 290)}
<text x="460" y="560" fill="#cfd6ee" font-size="13" font-family="DejaVu Sans">références tracées (rouge : marge haute, vert : basse, jaune : limbe de l’iris) : 04 · 07 · 11</text></svg>`;
png('02-almond-avant-apres-vs-references.png', new Resvg(fig2, { font: { loadSystemFonts: true } }).render().asPng() as Buffer);

// ---- 03 : balayage des paramètres ---------------------------------------------------------------------------------------------------------------------
const small = () => withPath(withPath(BASE, 'shape.width', 170), 'shape.height', 96);
const cells = SWEEPS.flatMap((s) => {
  const r = sweepResult(s);
  const base = small();
  const mk = (v: unknown) => ({ ...withPath(base, s.path, s.path === 'shape.width' ? (v as number) * 0.7 : s.path === 'shape.height' ? (v as number) * 0.7 : v) } as Record<string, unknown>);
  return [{ label: `${s.path} = ${String(s.lo)}`, eye: mk(s.lo), background: '#2b2f3f' }, { label: `${s.path} = ${String(s.hi)}   Δ ${r.changed} px · ${s.region}`, eye: mk(s.hi), background: '#2b2f3f' }];
});
png('03-parametres-consommes-bas-vs-haut.png', eyeSheetPng(cells, 4, 300, 270));

// ---- 04 / 05 : têtes complètes -------------------------------------------------------------------------------------------------------------------------
const recipes = extraEyeRecipes();
const STYLE_IDX = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'].map((st) => recipes.findIndex((r) => r.style === st));
type Obj = Record<string, any>;
function swapEyes(objects: readonly Obj[], cell: number, idx: number): Obj[] {
  const x = generateExtraEye(idx) as Obj;
  const aspect = x.shape.height / x.shape.width;
  return objects.map((o) => {
    const side = o.id === `c${cell}-eye-left` ? 'left' : o.id === `c${cell}-eye-right` ? 'right' : null;
    if (!side) return o;
    const { kind: _k, id: _i, place: _p, transform: _t, eyebrow: _e, shape: _s, ...rest } = x;
    return { ...o, ...rest, eyebrow: o.eyebrow, shape: { ...x.shape, outerSide: side, width: o.shape.width, height: o.shape.width * aspect } };
  });
}
const FACE = { eyeSource: 'random', expression: { kind: 'neutral', intensity: 1 }, hair: { style: 'short', fringe: 'sweep', color: '#2b1d14', seed: 2 }, facialHair: { mustache: 'none', beard: 'none' } } as never;
function heads(n: number, cols: number, cw: number, ch: number, s: number, pick: (i: number) => number, seedOf: (i: number) => number): Buffer {
  const L = layout(n, cols, cw, ch, s, (i) => ({ seed: seedOf(i), opts: FACE }));
  let objs: Obj[] = L.objects as Obj[];
  for (let i = 0; i < n; i++) objs = swapEyes(objs, i, pick(i));
  return render(objs as never, cols * cw, Math.ceil(n / cols) * ch, '', '#3b4157', cols * cw);
}
png('04-tetes-12-enveloppes.png', heads(12, 4, 300, 520, 0.62, (i) => STYLE_IDX[i]!, (i) => 321 + i * 7));
png('05-gros-plans-tetes-almond-et-extremes.png', heads(6, 3, 600, 760, 1.15, (i) => [STYLE_IDX[0]!, 30, 12, 47, STYLE_IDX[4]!, 77][i]!, (i) => 400 + i * 13));

// ---- 06 : rapport de vérification ---------------------------------------------------------------------------------------------------------------------
const report = Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => {
  const e = generateExtraEye(i) as never;
  const v = verifyEye(e);
  return { index: i, style: recipes[i]!.style, ok: v.ok, errors: v.failures.map((f) => f.id), warnings: v.warnings.map((w) => w.id), pixel: verifyEyeRender(e).filter((c) => !c.ok).map((c) => c.id), nearest: Math.round(recipes[i]!.nearest * 1e4) / 1e4 };
});
const warnCount: Record<string, number> = {};
for (const r of report) for (const w of r.warnings) warnCount[w] = (warnCount[w] ?? 0) + 1;
writeFileSync(`${OUT}/06-verification.json`, JSON.stringify({ eyes: EXTRA_EYE_COUNT, verifyEyeErrors: report.filter((r) => !r.ok).length, pixelFailures: report.filter((r) => r.pixel.length).length, warningsByRule: warnCount, distinctness: distinctness(), almond: { before: { lowerPeakAt: oldP.lowerPeakAt, upperPeakAt: oldP.upperPeakAt, innerAngle: oldP.canthusAngleDeg.inner }, after: { lowerPeakAt: newP.lowerPeakAt, upperPeakAt: newP.upperPeakAt, innerAngle: newP.canthusAngleDeg.inner } }, perEye: report }, null, 1));
console.log('06-verification.json', JSON.stringify({ errors: report.filter((r) => !r.ok).length, pixel: report.filter((r) => r.pixel.length).length, warnings: warnCount }));
