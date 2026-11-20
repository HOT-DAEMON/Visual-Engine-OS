import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { mulberry32 } from '../src/core/prng';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { Shape } from '../src/schema/eye-shape';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { EXTRA3_COUNT, distinctness3, extra3Recipes, generateExtra3Eye } from '../src/generation/eye-gallery-ext3';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { EXTENDED2_IDENTITIES } from '../src/generation/eye-pool';
import { verifyEye } from '../src/verify/eye';
import { evalLowerPeak } from './eye-refs/lowerpeak-eval';
import { eyeCellSvg, eyeSheetPng } from './lib/eye-sheet';
import { irisTone } from './lib/eye-iris-tone';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 10 : `npx tsx scripts/artefacts-eyes-pass10.ts` → `artefacts/eyes-pass10/`
 *   01 mesures d'iris (réfs 04, 07, 08 ×2, 10 ×2) + 02 bandeau des iris de référence (python3 scripts/eye-refs/extract_iris_photos.py)
 *   03 familles d'iris : référence (haut) / moteur (bas) · 04 galerie 3 : 100 yeux de plus · 05 têtes entières · 06 almond : creux de la paupière basse (lowerPeak)
 *   07 symétrie gauche / droite des enveloppes (contrat de hauteur corrigé) · 08 rapport chiffré recalculé ici.
 */
const OUT = 'artefacts/eyes-pass10'; mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const png = (svg: string): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
const rc3 = extra3Recipes(); const rc2 = extra2Recipes();

// 03 : références (bandeau de 02) au-dessus, moteur en dessous — mêmes 5 familles, même œil almond de base, graine 7 + i
const baseIdx = rc2.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const W = 330, H = 270; let s03 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 5}" height="${330 + H + 60}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
s03 += `<text x="8" y="18" font-size="15" font-family="DejaVu Sans" fill="#222">Références mesurées (04 · 07 · 08a · 10a · 10b)</text><image href="${b64(readFileSync(`${OUT}/02-iris-references.png`))}" x="0" y="24" width="${W * 5}" height="330"/>`;
s03 += `<text x="8" y="${330 + 48}" font-size="15" font-family="DejaVu Sans" fill="#222">Moteur : ${PHOTO2_IRIS_FAMILIES.join(' · ')}</text>`;
PHOTO2_IRIS_FAMILIES.forEach((f, i) => {
  const eye = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false);
  s03 += `<image href="${b64(png(eyeCellSvg(eye as never, W, H, '#f4ede6', 'n')))}" x="${i * W}" y="${330 + 56}"/>`;
});
writeFileSync(`${OUT}/03-familles-moteur.png`, png(`${s03}</svg>`));

// 04 : galerie 3
writeFileSync(`${OUT}/04-galerie3-100-yeux.png`, eyeSheetPng(Array.from({ length: EXTRA3_COUNT }, (_, i) => ({ label: `${i} ${rc3[i]!.style} · ${rc3[i]!.irisFamily ?? 'naturel'}`, eye: generateExtra3Eye(i) as Record<string, unknown> })), 10, 250, 190, true));

// 05 : têtes entières (2 identités par famille photo 2 + 2 naturels) et gros plans
const pick = (f: string | null, n: number): number[] => rc3.filter((r) => r.irisFamily === f).slice(0, n).map((r) => EXTENDED2_IDENTITIES + r.index);
const ids = [...PHOTO2_IRIS_FAMILIES.flatMap((f) => pick(f, 2)), ...pick(null, 2)];
const L = layout(ids.length, 6, 250, 440, 0.62, (i) => ({ seed: 1300 + i * 11, opts: { eyeSource: 'extended3', identity: ids[i], lashFamily: null } as never }));
writeFileSync(`${OUT}/05-tetes-entieres.png`, render(L.objects as never, 1500, 880, '', '#3b4157', 1500));
for (const [f, tag] of [['fire-halo', 'fire-halo'], ['ice-star', 'ice-star'], ['prism-star', 'prism-star']] as const) {
  const c = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4343, opts: { eyeSource: 'extended3', identity: pick(f, 1)[0], lashFamily: null } as never }));
  writeFileSync(`${OUT}/05b-tete-gros-plan-${tag}.png`, render(c.objects as never, 700, 900, '', '#3b4157', 700));
}

// 06 : almond — profil bas mesuré (noir), moteur sans lowerPeak (rouge), avec lowerPeak = creux mesuré (vert)
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { aspect: number; upperFraction: number; tiltDeg: number; lowerProfile: number[] }>;
const REFS = ['04', '07', '11', '03', '05']; const lp = evalLowerPeak(REFS);
const CW = 300, CH = 230; let s06 = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * 5}" height="${CH + 70}"><rect width="100%" height="100%" fill="#fff"/>`;
REFS.forEach((k, i) => {
  const r = M[k]!; const prof = (lowerPeak?: number) => openingProfile(openingGeometry(Shape.parse({ style: 'almond', width: 1000, height: r.aspect * 1000, upperFraction: r.upperFraction, tiltDeg: r.tiltDeg, ...(lowerPeak === undefined ? {} : { lowerPeak }) }), Canthi.parse({}))).lower;
  const peak = r.lowerProfile.indexOf(Math.max(...r.lowerProfile)) / 20; const max = 0.3; const ox = i * CW + 30;
  const path = (v: readonly number[], col: string, dash = ''): string => `<polyline fill="none" stroke="${col}" stroke-width="2.4" ${dash} points="${v.map((y, j) => `${ox + (j / 20) * (CW - 50)},${CH - 20 - (y / max) * (CH - 50)}`).join(' ')}"/>`;
  s06 += `<line x1="${ox}" y1="${CH - 20}" x2="${ox + CW - 50}" y2="${CH - 20}" stroke="#999"/>${path(r.lowerProfile, '#111')}${path(prof(), '#d33', 'stroke-dasharray="6 4"')}${path(prof(peak), '#1a9a3a')}`;
  s06 += `<text x="${ox}" y="18" font-size="14" font-family="DejaVu Sans">réf. ${k}${k === '03' || k === '05' ? ' (hors ajustement)' : ''}</text><text x="${ox}" y="${CH + 4}" font-size="12" font-family="DejaVu Sans">creux ${lp[k]!.peakRef} · RMS ${lp[k]!.rmsLoSans} → ${lp[k]!.rmsLoAvec}</text>`;
});
s06 += `<text x="10" y="${CH + 40}" font-size="13" font-family="DejaVu Sans">profil BAS (unités de largeur) : noir = référence mesurée · rouge pointillé = almond sans lowerPeak · vert = almond avec lowerPeak = creux mesuré</text></svg>`;
writeFileSync(`${OUT}/06-almond-lowerpeak.png`, png(s06));

// 07 : symétrie gauche / droite (après correction : mêmes apex et même hauteur côté gauche)
const sym = ['almond', 'sharp', 'drooping', 'chibi'].flatMap((st) => ['right', 'left'].map((side) => { const e = generateExtra2Eye(rc2.findIndex((r) => r.style === st)) as Record<string, any>; return { label: `${st} · ${side}`, eye: { ...e, shape: { ...e.shape, outerSide: side } } as Record<string, unknown> }; }));
writeFileSync(`${OUT}/07-symetrie-gauche-droite.png`, eyeSheetPng(sym, 4, 330, 250, true));

// 08 : rapport chiffré
const fails: Record<string, number> = {}; const warns: Record<string, number> = {}; const tex: Record<string, number[]> = {}; let verifyFail = 0;
for (let i = 0; i < EXTRA3_COUNT; i++) {
  const e = generateExtra3Eye(i); const v = verifyEye(e as never) as { ok: boolean; checks?: { id: string; ok: boolean }[] }; if (!v.ok) verifyFail++; for (const c of v.checks ?? []) if (!c.ok) warns[c.id] = (warns[c.id] ?? 0) + 1;
  for (const c of verifyEyeRender(e as never)) { if (!c.ok) fails[c.id] = (fails[c.id] ?? 0) + 1; if (c.id === 'iris-texture') (tex[rc3[i]!.irisFamily ?? 'naturel'] ??= []).push(c.value); }
}
const J = Object.fromEntries((JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')) as { eyes: { id: string; tone: unknown }[] }).eyes.map((e) => [e.id, e.tone]));
const toneTable = Object.fromEntries(PHOTO2_IRIS_FAMILIES.map((f, i) => [f, { reference: J[PHOTO2_IRIS_MEASURES[f].ref], moteur: irisTone(applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as never) }]));
const stat = (v: number[]): { n: number; min: number; median: number } => { const a = [...v].sort((x, y) => x - y); return { n: a.length, min: +a[0]!.toFixed(2), median: +a[Math.floor(a.length / 2)]!.toFixed(2) }; };
writeFileSync(`${OUT}/08-rapport-passe10.json`, JSON.stringify({ distinctness3: distinctness3(), verifyEyeErreurs: verifyFail, avertissementsVerifyEye: warns, echecsPixels: fails, textureIris: Object.fromEntries(Object.entries(tex).map(([k, v]) => [k, stat(v)])), toneParite: toneTable, lowerPeakReferences: lp }, null, 1));
console.log('ok');
