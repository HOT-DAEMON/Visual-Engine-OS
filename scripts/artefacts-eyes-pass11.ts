import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { EXTRA4_COUNT, distinctness4, extra4Recipes, generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { EXTENDED3_IDENTITIES } from '../src/generation/eye-pool';
import { verifyEye } from '../src/verify/eye';
import { eyeSheetPng } from './lib/eye-sheet';
import { irisTone } from './lib/eye-iris-tone';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 11 : `npx tsx scripts/artefacts-eyes-pass11.ts` → `artefacts/eyes-pass11/`
 *   01 gros plans d'iris : référence (haut, bandeau de la passe 10) / moteur (bas) · 02 avant / après vibrance (0 contre valeur calibrée) · 03 galerie 4 : 100 yeux (enveloppes issues des réfs 13/17, lowerPeak)
 *   04 têtes entières (eyeSource 'extended4') + gros plans · 05 lowerPeak : balayage 0,40 → 0,65 sur un almond · 06 rapport chiffré (distinction, vérifications, tons avant / après).
 */
const OUT = 'artefacts/eyes-pass11'; mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const png = (svg: string): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
const rc2 = extra2Recipes(); const rc4 = extra4Recipes();
const baseIdx = rc2.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const famEye = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], patch?: (e: any) => void): Record<string, unknown> => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as any; patch?.(e); return e; };
/** Gros plan de l'iris : œil rendu en grand puis recadré sur le disque d'iris. */
/** Gros plan : l'œil est dessiné à l'échelle `k` (la largeur de forme est absolue : agrandir le canevas ne zoome pas), centré sur l'iris. */
let zid = 0;
/** Chaque cellule est rasterisée À PART puis embarquée en image : composer les SVG tels quels mélangerait les iris (ids de dégradés partagés). */
const zoom = (eye: Record<string, unknown>, w = 560, h = 480, k = 2.5): string => {
  const r: any = compileScene({ width: w, height: h, background: '#f4ede6', objects: [{ kind: 'eye', id: `z${zid++}`, transform: { x: w / 2, y: h / 2 + 4, scale: k }, ...eye }] } as never); if (!r.ok) throw new Error(r.issues.join('\n'));
  return `<image href="${b64(png(r.svg as string))}" width="${w}" height="${h}"/>`;   // PNG séparé : les ids (dégradés, filtres) dérivent de la graine de l'œil, communes aux 5 yeux de base
};
const ZW = 560;

// 01 : références au-dessus, moteur en dessous (gros plan)
const C = PHOTO2_IRIS_FAMILIES.length; const CW = 330, CH = 280;
let s01 = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * C}" height="${330 + CH + 60}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
s01 += `<text x="8" y="18" font-size="15" font-family="DejaVu Sans" fill="#222">Références mesurées (04 · 07 · 08a · 10a · 10b)</text><image href="${b64(readFileSync('artefacts/eyes-pass10/02-iris-references.png'))}" x="0" y="24" width="${CW * C}" height="300" preserveAspectRatio="xMidYMid slice"/>`;
s01 += `<text x="8" y="${330 + 24}" font-size="15" font-family="DejaVu Sans" fill="#222">Moteur (passe 11) : ${PHOTO2_IRIS_FAMILIES.join(' · ')}</text>`;
PHOTO2_IRIS_FAMILIES.forEach((f, i) => { s01 += `<g transform="translate(${i * CW},${330 + 32}) scale(${CW / ZW})">${zoom(famEye(f))}</g>`; });
writeFileSync(`${OUT}/01-iris-reference-vs-moteur.png`, png(`${s01}</svg>`));

// 02 : avant (vibrance 0) / après (valeur calibrée), mesure sous chaque cellule
let s02 = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * C}" height="${2 * CH + 110}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
const J = Object.fromEntries((JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')) as { eyes: { id: string; tone: { satPeaks: number } }[] }).eyes.map((e) => [e.id, e.tone]));
const sat: Record<string, { reference: number; avant: number; apres: number; vibrance: number }> = {};
PHOTO2_IRIS_FAMILIES.forEach((f, i) => {
  const after = famEye(f); const before = famEye(f, (e) => { e.iris.vibrance = 0; }); const sa = irisTone(after as never).satPeaks, sb = irisTone(before as never).satPeaks; const rf = (J[PHOTO2_IRIS_MEASURES[f].ref] as { satPeaks: number }).satPeaks;
  sat[f] = { reference: rf, avant: sb, apres: sa, vibrance: (after as any).iris.vibrance };
  s02 += `<g transform="translate(${i * CW},20) scale(${CW / ZW})">${zoom(before)}</g><g transform="translate(${i * CW},${CH + 60}) scale(${CW / ZW})">${zoom(after)}</g>`;
  s02 += `<text x="${i * CW + 8}" y="14" font-size="13" font-family="DejaVu Sans" fill="#222">${f} · vibrance 0 · pics ${sb}</text><text x="${i * CW + 8}" y="${CH + 56}" font-size="13" font-family="DejaVu Sans" fill="#222">vibrance ${(after as any).iris.vibrance} · pics ${sa} (réf. ${rf})</text>`;
});
writeFileSync(`${OUT}/02-vibrance-avant-apres.png`, png(`${s02}</svg>`));

// 03 : galerie 4
writeFileSync(`${OUT}/03-galerie4-100-yeux.png`, eyeSheetPng(Array.from({ length: EXTRA4_COUNT }, (_, i) => ({ label: `${i} ${rc4[i]!.style} · lp ${rc4[i]!.lowerPeak!.toFixed(2)} · ${rc4[i]!.irisFamily ?? 'naturel'}`, eye: generateExtra4Eye(i) as Record<string, unknown> })), 10, 250, 190, true));

// 04 : têtes entières de la source 'extended4'
const pick = (f: string | null, n: number): number[] => rc4.filter((r) => r.irisFamily === f).slice(0, n).map((r) => EXTENDED3_IDENTITIES + r.index);
const ids = [...PHOTO2_IRIS_FAMILIES.flatMap((f) => pick(f, 2)), ...pick(null, 2)];
const L = layout(ids.length, 6, 250, 440, 0.62, (i) => ({ seed: 1700 + i * 11, opts: { eyeSource: 'extended4', identity: ids[i], lashFamily: null } as never }));
writeFileSync(`${OUT}/04-tetes-entieres.png`, render(L.objects as never, 1500, 880, '', '#3b4157', 1500));
for (const f of ['prism-star', 'emerald-facets', 'ice-star'] as const) {
  const c = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4343, opts: { eyeSource: 'extended4', identity: pick(f, 1)[0], lashFamily: null } as never }));
  writeFileSync(`${OUT}/04b-tete-gros-plan-${f}.png`, render(c.objects as never, 700, 900, '', '#3b4157', 700));
}

// 05 : lowerPeak, balayage sur un almond (un seul paramètre varie)
const sweep = [0.4, 0.475, 0.55, 0.65].map((v) => ({ label: `almond · shape.lowerPeak = ${v}`, eye: { ...(generateExtra2Eye(baseIdx) as Record<string, any>), shape: { ...(generateExtra2Eye(baseIdx) as Record<string, any>).shape, lowerPeak: v } } as Record<string, unknown> }));
writeFileSync(`${OUT}/05-lowerpeak-balayage.png`, eyeSheetPng(sweep, 4, 330, 250, true));

// 06 : rapport
const fails: Record<string, number> = {}; const warns: Record<string, number> = {}; let verifyFail = 0;
for (let i = 0; i < EXTRA4_COUNT; i++) {
  const e = generateExtra4Eye(i); const v = verifyEye(e as never) as { ok: boolean; checks?: { id: string; ok: boolean }[] }; if (!v.ok) verifyFail++; for (const c of v.checks ?? []) if (!c.ok) warns[c.id] = (warns[c.id] ?? 0) + 1;
  for (const c of verifyEyeRender(e as never)) if (!c.ok) fails[c.id] = (fails[c.id] ?? 0) + 1;
}
const tone = Object.fromEntries(PHOTO2_IRIS_FAMILIES.map((f) => [f, { reference: J[PHOTO2_IRIS_MEASURES[f].ref], moteur: irisTone(famEye(f) as never) }]));
writeFileSync(`${OUT}/06-rapport-passe11.json`, JSON.stringify({ distinctness4: distinctness4(), verifyEyeErreurs: verifyFail, avertissementsVerifyEye: warns, echecsPixels: fails, saturationPics: sat, toneParite: tone }, null, 1));
console.log('ok');
