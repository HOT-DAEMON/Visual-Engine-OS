import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { mulberry32 } from '../src/core/prng';
import { EXTENDED_IDENTITIES } from '../src/generation/eye-pool';
import { EXTRA2_COUNT, distinctness2, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO_IRIS_FAMILIES, PHOTO_IRIS_MEASURES, photoIrisFamily } from '../src/generation/eye-iris-families-photo';
import { holdout } from './eye-refs/almond-holdout';
import { eyeCellSvg, eyeSheetPng } from './lib/eye-sheet';
import { layout, render } from './lib/proof';
import { verifyEye } from '../src/verify/eye';
import { IRIS_TEXTURE_DETAIL_MIN, verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 9 : `npx tsx scripts/artefacts-eyes-pass9.ts` → `artefacts/eyes-pass9/`
 *   01 mesures d'iris des réfs 03 / 05 / 06 / 09 (python3 scripts/eye-refs/extract_iris_photos.py) · 02 tracé des paupières 03 / 05 (extract.py)
 *   03 familles d'iris : référence (haut) / moteur (bas) · 04 galerie des 100 yeux supplémentaires · 05 têtes entières · 06 rapport chiffré recalculé ici.
 */
const OUT = 'artefacts/eyes-pass9'; mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const rc = extra2Recipes();

// 02 : copie des superpositions de tracé (extract.py les écrit dans artefacts/eyes-refs/)
for (const id of ['03', '05']) copyFileSync(`artefacts/eyes-refs/overlay-${id}.png`, `${OUT}/02-trace-paupieres-${id}.png`);

// 03 : famille d'iris rendue par le moteur (œil almond de la galerie 2, même graine pour les 4) — à comparer au bandeau de références de 01
const baseIdx = rc.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const W = 520, H = 340; let s03 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 4}" height="${H + 30}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
PHOTO_IRIS_FAMILIES.forEach((f, i) => {
  const e = generateExtra2Eye(baseIdx) as Record<string, any>; const p = photoIrisFamily(f, mulberry32(7 + i));
  const eye = { ...e, finish: 'shaded', archetype: null, iris: { ...e.iris, layers: p.layers, detail: p.detail, limbalRing: p.limbalRing, fibers: p.fibers, glow: p.glow, ...(p.irisAspect ? { aspect: p.irisAspect } : {}) }, pupil: { ...e.pupil, shape: 'round', size: p.pupil.size, deform: { ...(e.pupil?.deform ?? {}), squash: p.pupil.squash } }, highlights: { list: p.highlights } };
  s03 += `<image href="${b64(new Resvg(eyeCellSvg(eye, W, H, '#f4ede6', 'n')).render().asPng())}" x="${i * W}" y="30"/><text x="${i * W + 8}" y="20" font-size="15" font-family="DejaVu Sans" fill="#222">${f} (réf. ${PHOTO_IRIS_MEASURES[f].ref})</text>`;
});
writeFileSync(`${OUT}/03-familles-moteur.png`, new Resvg(`${s03}</svg>`, { font: { loadSystemFonts: true } }).render().asPng());

// 04 : galerie des 100 yeux supplémentaires
const cells = Array.from({ length: EXTRA2_COUNT }, (_, i) => ({ label: `${i} ${rc[i]!.style} · ${rc[i]!.irisFamily ?? 'naturel'}`, eye: generateExtra2Eye(i) as Record<string, unknown> }));
writeFileSync(`${OUT}/04-galerie2-100-yeux.png`, eyeSheetPng(cells, 10, 250, 190, true));

// 05 : têtes entières (2 identités par famille d'iris photo + 2 naturels) et gros plan
const pick = (f: string | null, n: number): number[] => rc.filter((r) => r.irisFamily === f).slice(0, n).map((r) => EXTENDED_IDENTITIES + r.index);
const ids = [...PHOTO_IRIS_FAMILIES.flatMap((f) => pick(f, 2)), ...pick(null, 2)];
const L = layout(ids.length, 5, 300, 520, 0.62, (i) => ({ seed: 1300 + i * 11, opts: { eyeSource: 'extended2', identity: ids[i], lashFamily: null } as never }));
writeFileSync(`${OUT}/05-tetes-entieres.png`, render(L.objects as never, 1500, 1040, '', '#3b4157', 1500));
const fam0 = pick('frost-fern', 1)[0]!; const close = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4343, opts: { eyeSource: 'extended2', identity: fam0, lashFamily: null } as never }));
writeFileSync(`${OUT}/05b-tete-gros-plan-frost-fern.png`, render(close.objects as never, 700, 900, '', '#3b4157', 700));
const fam1 = pick('slit-sunburst', 1)[0]!; const close2 = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4344, opts: { eyeSource: 'extended2', identity: fam1, lashFamily: null } as never }));
writeFileSync(`${OUT}/05c-tete-gros-plan-slit-sunburst.png`, render(close2.objects as never, 700, 900, '', '#3b4157', 700));

// 06 : rapport chiffré (tout est recalculé ici)
const fails: Record<string, number> = {}; const warns: Record<string, number> = {}; const tex: Record<string, number[]> = {}; let verifyFail = 0;
for (let i = 0; i < EXTRA2_COUNT; i++) {
  const e = generateExtra2Eye(i); const v = verifyEye(e as never) as { ok: boolean; checks?: { id: string; ok: boolean }[] };
  if (!v.ok) verifyFail++; for (const c of v.checks ?? []) if (!c.ok) warns[c.id] = (warns[c.id] ?? 0) + 1;
  for (const c of verifyEyeRender(e as never)) { if (!c.ok) fails[c.id] = (fails[c.id] ?? 0) + 1; if (c.id === 'iris-texture') (tex[rc[i]!.irisFamily ?? 'naturel'] ??= []).push(c.value); }
}
const stat = (v: number[]): { n: number; min: number; median: number } => { const a = [...v].sort((x, y) => x - y); return { n: a.length, min: +a[0]!.toFixed(2), median: +a[Math.floor(a.length / 2)]!.toFixed(2) }; };
writeFileSync(`${OUT}/06-rapport-passe9.json`, JSON.stringify({ distinctness2: distinctness2(), verifyEyeErreurs: verifyFail, avertissementsVerifyEye: warns, echecsPixels: fails, textureIris: Object.fromEntries(Object.entries(tex).map(([k, v]) => [k, stat(v)])), seuilTextureDetail: IRIS_TEXTURE_DETAIL_MIN, texturesReferences: { '03': 36.7, '05': 22.5, '06': 35.2, '09': 42.1 }, almondHorsEchantillon: holdout(['04', '07', '11', '03', '05']) }, null, 1));
console.log('ok');
