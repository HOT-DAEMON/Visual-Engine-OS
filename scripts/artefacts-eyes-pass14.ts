import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { EXTRA4_COUNT, extra4Recipes, generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { PHOTO2_IRIS_MEASURES } from '../src/generation/eye-iris-families-photo2';
import { EXTENDED3_IDENTITIES } from '../src/generation/eye-pool';
import { pupilOccludedByStar } from '../src/geometry/eye';
import { verifyEye } from '../src/verify/eye';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { atomMetrics } from './lib/eye-iris-atoms';
import { irisTone } from './lib/eye-iris-tone';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 14 : `npx tsx scripts/artefacts-eyes-pass14.ts` → `artefacts/eyes-pass14/`
 *   01 emerald : référence 07 · avant (passe 13) · après (passe 14) · 02 pupilles noyées dans une étoile (30 faux avertissements) + contre-exemple · 03 têtes entières emerald (galerie 4) + gros plan
 *   04 rapport chiffré (filtres, mesures emerald avant/après, vérification de la galerie 4).
 */
const OUT = 'artefacts/eyes-pass14'; mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const png = (svg: string): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
const T = (x: number, y: number, t: string, s = 13): string => `<text x="${x}" y="${y}" font-size="${s}" font-family="DejaVu Sans" fill="#222">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
let zid = 0; const ZW = 560, ZH = 480;
const zoom = (eye: Record<string, unknown>, k = 2.5): string => { const r: any = compileScene({ width: ZW, height: ZH, background: '#f4ede6', objects: [{ kind: 'eye', id: `z${zid++}`, transform: { x: ZW / 2, y: ZH / 2 + 4, scale: k }, ...eye, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return `<image href="${b64(png(r.svg as string))}" width="${ZW}" height="${ZH}"/>`; };
const D = (e: any): any => e.iris.detail;
const before = (e: any): any => { D(e).facets.count = 20; D(e).facets.cut = 0.8; D(e).voids[0].outer = 0.34; return e; };   // réglages de la passe 13

// 01 : réf. 07 · avant · après
const sc = 0.62; const refId = PHOTO2_IRIS_MEASURES['emerald-facets'].ref;
const ref = `<image href="${b64(readFileSync(`artefacts/eyes-pass12/refs/${refId}-crop.png`))}" width="${ZW * sc}" height="${ZH * sc}" preserveAspectRatio="xMidYMid slice"/>`;
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${ZW * sc * 3}" height="${ZH * sc + 40}"><rect width="100%" height="100%" fill="#f4ede6"/>`
  + `<g transform="translate(0,26)">${ref}</g>${T(6, 16, `référence ${refId}`)}`
  + `<g transform="translate(${ZW * sc},26) scale(${sc})">${zoom(before(famEye('emerald-facets')))}</g>${T(ZW * sc + 6, 16, 'passe 13 : 20 facettes, vide interne 0,34')}`
  + `<g transform="translate(${2 * ZW * sc},26) scale(${sc})">${zoom(famEye('emerald-facets'))}</g>${T(2 * ZW * sc + 6, 16, 'passe 14 : 36 facettes, vide interne 0,22')}</svg>`;
writeFileSync(`${OUT}/01-emerald-reference-avant-apres.png`, png(s));

// 02 : pupilles noyées dans une étoile — 4 yeux de la galerie 4 qui avertissaient + contre-exemple (pupille claire, sans étoile)
const flagged = [14, 23, 44, 82]; const cw = 330, ch = 280, k2 = cw / ZW;
const lightPupil = (() => { const e: any = famEye('emerald-facets'); e.pupil.fill = { type: 'solid', color: '#e8e8e8' }; e.highlights = { ...e.highlights, list: [] }; return e; })();
const cases: { eye: any; label: string }[] = [...flagged.map((i) => ({ eye: generateExtra4Eye(i), label: `galerie 4 · œil ${i}` })), { eye: lightPupil, label: 'contre-exemple : pupille claire, sans étoile' }];
s = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw * cases.length}" height="${ch + 70}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
cases.forEach(({ eye, label }, i) => { const c: any = (verifyEye(eye).checks as any[]).find((x) => x.id === 'pupil-darker-than-iris');
  s += `<g transform="translate(${i * cw},44) scale(${k2})">${zoom(eye)}</g>${T(i * cw + 6, 14, label, 12)}${T(i * cw + 6, 30, `étoile centrée : ${pupilOccludedByStar(eye) ? 'oui' : 'non'} · règle : ${c ? (c.ok ? 'ok' : `AVERTIT (${Number(c.value).toFixed(3)})`) : 'non évaluée'}`, 11)}`; });
writeFileSync(`${OUT}/02-pupille-noyee-regle.png`, png(`${s}</svg>`));

// 03 : têtes entières (galerie 4, iris emerald) + gros plan
const rc4 = extra4Recipes(); const ids = rc4.filter((r) => r.irisFamily === 'emerald-facets').slice(0, 5).map((r) => EXTENDED3_IDENTITIES + r.index);
const L = layout(ids.length, 5, 220, 400, 0.56, (i) => ({ seed: 2100 + i * 13, opts: { eyeSource: 'extended4', identity: ids[i], lashFamily: null } as never }));
writeFileSync(`${OUT}/03-tetes-entieres-emerald.png`, render(L.objects as never, 1100, 440, '', '#3b4157', 1100));
const c1 = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4343, opts: { eyeSource: 'extended4', identity: ids[0], lashFamily: null } as never }));
writeFileSync(`${OUT}/03b-tete-gros-plan-emerald.png`, render(c1.objects as never, 700, 900, '', '#3b4157', 700));

// 04 : rapport chiffré
const T2 = (JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as any[]).find((e) => e.id === refId).tone;
const A = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes[refId];
const stat = (e: any): Record<string, unknown> => { const m = atomMetrics(e); const t = irisTone(e); return { darkShare: t.darkShare, lumMean: t.lumMean, satPeaks: t.satPeaks, cellules: m.cells.count, celluleMediane: m.cells.areaMedian, fentes: m.slits.persistentCount, fenteDerive: (m.slits as any).meanDriftPerRho, etoilesTop6: m.stars.feretTop6Mean, etoilePremiere: m.stars.top[0]?.feretOverR }; };
const filters: Record<string, number> = {}; const FILTERS_BEFORE: Record<string, number> = { 'prism-star': 11, 'emerald-facets': 15, 'lime-cyan': 5, 'fire-halo': 12, 'ice-star': 18 };
for (const f of Object.keys(FILTERS_BEFORE)) { const r: any = compileScene({ width: 560, height: 480, background: '#ffffff', objects: [{ kind: 'eye', id: 'z', transform: { x: 280, y: 240, scale: 2.5 }, ...famEye(f as never), eyebrow: null }] } as never); filters[f] = (r.svg.match(/<filter /g) ?? []).length; }
const warn: Record<string, number> = {}; let pixFails = 0;
for (let i = 0; i < EXTRA4_COUNT; i++) { const e = generateExtra4Eye(i) as any; for (const c of verifyEye(e).checks as any[]) if (!c.ok && ['pupil-darker-than-iris', 'svg-weight', 'filter-budget'].includes(c.id)) warn[c.id] = (warn[c.id] ?? 0) + 1; pixFails += verifyEyeRender(e).filter((c) => !c.ok).length; }
writeFileSync(`${OUT}/04-rapport-passe14.json`, JSON.stringify({
  filtresSvg: { avant: FILTERS_BEFORE, apres: filters, limite: 14, note: 'décompte des définitions ; le temps de rastérisation resvg ne change pas (≈ 408 ms pour ice-star avant comme après : coût par application, pas par définition)' },
  emerald: { reference: { darkShare: T2.darkShare, lumMean: T2.lumMean, satPeaks: T2.satPeaks, cellules: A.cells.count, fentes: A.slits.persistentCount, etoilesTop6: A.stars.feretTop6Mean }, passe13: stat(before(famEye('emerald-facets'))), passe14: stat(famEye('emerald-facets')) },
  galerie4: { avertissementsApres: warn, avertissementsAvant: { 'pupil-darker-than-iris': 30, 'svg-weight': 44 }, echecsPixels: pixFails },
}, null, 1));
console.log('ok');
