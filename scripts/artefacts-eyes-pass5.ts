import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { EXTRA_EYE_COUNT, distinctness, extraEyeLashFamily, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { LASH_FAMILIES, LASH_FAMILY_IDS, LASH_INK_COLOR, applyLashFamily } from '../src/generation/eye-lash-families';
import { eyeSheetPng } from './lib/eye-sheet';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la passe « audit des cils » : `npx tsx scripts/artefacts-eyes-pass5.ts`
 *   01 encre : ancienne (#120e18) contre encre mesurée (#040404) · 02 contrat d'encre family / keep · 03 familles de cils sur 2 yeux · 04 galerie des 100 (distance minimale ≥ 0,02)
 *   05 (déjà là) extraction de la réf. 17 rejetée · 06 (extract_iris_colour.py) iris colorés mesurés · 07 têtes entières · 08 rapport chiffré (rapport-passe5.json)
 */
const OUT = 'artefacts/eyes-pass5';
mkdirSync(OUT, { recursive: true });
const CW = 300, CH = 230;
const at = (e: Record<string, unknown>, x: number, y: number, s: number): Record<string, unknown> => ({ ...e, transform: { x, y, scale: s } });
const noBrow = (i: number): Record<string, unknown> => ({ ...generateExtraEye(i), eyebrow: null });
const recolour = (e: Record<string, unknown>, color: string, linerColor: string): Record<string, unknown> => {
  const l = e.lashes as { upper: Record<string, unknown>; lower: Record<string, unknown> }; const mat = { base: { type: 'solid', color }, roughness: 0.6 };
  const lids = { ...(e.lids as Record<string, unknown>) }; if (lids.liner) lids.liner = { ...(lids.liner as Record<string, unknown>), color: linerColor };
  return { ...e, lids, lashes: { upper: { ...l.upper, material: mat }, lower: { ...l.lower, material: mat } } };
};

// 01 : ancienne encre contre encre mesurée, sur deux yeux et deux familles
const cells01 = [6, 40].flatMap((i) => (['plume', 'aile-liner'] as const).flatMap((f) => {
  const base = applyLashFamily(noBrow(i), f) as Record<string, unknown>;
  return [{ label: `œil ${i} ${f} · avant #120e18`, eye: at(recolour(base, '#120e18', '#0c0a10'), CW / 2, CH * 0.55, 0.62) },
          { label: `œil ${i} ${f} · mesurée ${LASH_INK_COLOR}`, eye: at(base, CW / 2, CH * 0.55, 0.62) }];
}));
writeFileSync(`${OUT}/01-encre-ancienne-contre-mesuree.png`, eyeSheetPng(cells01, 4, CW, CH));

// 02 : contrat d'encre — œil à cils bruns translucides : 'keep' conserve l'apparence, 'family' impose l'encre
const brown = (i: number): Record<string, unknown> => ({ ...noBrow(i), lashes: { upper: { material: { base: { type: 'solid', color: '#7a4b2a' }, roughness: 0.3 }, opacity: 0.6, gloss: 0, colorVariation: 0.2 }, lower: { opacity: 0.5 } } });
const cells02 = (['plume', 'frange-dense', 'trio-externe'] as const).flatMap((f) => [
  { label: `${f} · ink 'keep'`, eye: at(applyLashFamily(brown(6), f, { ink: 'keep' }), CW / 2, CH * 0.55, 0.62) },
  { label: `${f} · ink 'family'`, eye: at(applyLashFamily(brown(6), f, { ink: 'family' }), CW / 2, CH * 0.55, 0.62) },
]);
writeFileSync(`${OUT}/02-contrat-encre-keep-family.png`, eyeSheetPng(cells02, 2, CW, CH));

// 03 : familles sur deux yeux
const cells03 = [6, 40].flatMap((i) => LASH_FAMILY_IDS.map((id) => ({ label: `œil ${i} · ${LASH_FAMILIES[id].label}`, eye: at(applyLashFamily(noBrow(i), id), CW / 2, CH * 0.55, 0.6) })));
writeFileSync(`${OUT}/03-familles-de-cils-encre-mesuree.png`, eyeSheetPng(cells03, 5, CW, CH));

// 04 : galerie des 100 (échelle par œil) avec distance au plus proche voisin
const rec = extraEyeRecipes();
const gal = Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => {
  const e = noBrow(i) as { shape: { width: number; height: number } }; const f = extraEyeLashFamily(i);
  const s = Math.min(0.6, 138 / (e.shape.height * 1.6), 215 / (e.shape.width * 1.6));
  return { label: `#${i} ${rec[i]?.style ?? ''}${rec[i]?.ref ? ' ' + rec[i]?.ref : ''} · d=${(rec[i]?.nearest ?? 0).toFixed(3)} · ${f ?? 'cils d’origine'}`, eye: at(e as never, 115, 92, s) };
});
writeFileSync(`${OUT}/04-galerie-100-formes-distinctes.png`, eyeSheetPng(gal, 10, 230, 175));

// 07 : têtes entières (identités étendues, famille tirée)
const ids = [15, 22, 31, 47, 58, 64, 71, 80, 88, 93, 97, 99].map((k) => 48 + k);
const L = layout(ids.length, 4, 300, 520, 0.62, (i) => ({ seed: 1200 + i * 11, opts: { eyeSource: 'extended', identity: ids[i], lashFamily: 'auto' } as never }));
writeFileSync(`${OUT}/07-tetes-entieres.png`, render(L.objects as never, 1200, 1560, '', '#3b4157', 1200));
const close = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4242, opts: { eyeSource: 'extended', identity: 48 + 22, lashFamily: 'fin-feminin' } as never }));
writeFileSync(`${OUT}/07b-tete-gros-plan.png`, render(close.objects as never, 700, 900, '', '#3b4157', 700));

// 08 : rapport chiffré (tout est recalculé ici, rien n'est recopié)
const tally: Record<string, { checked: number; failed: number }> = {};
for (let i = 0; i < EXTRA_EYE_COUNT; i++) for (const c of verifyEyeRender(generateExtraEye(i) as never)) { const t = (tally[`${c.layer}/${c.id}`] ??= { checked: 0, failed: 0 }); t.checked++; if (!c.ok) t.failed++; }
const fam: Record<string, { checked: number; failed: number }> = {};
for (const id of LASH_FAMILY_IDS) for (const i of [0, 6, 17, 33, 40, 58, 77, 91]) for (const c of verifyEyeRender(applyLashFamily({ ...generateExtraEye(i), eyebrow: null } as never, id) as never)) { if (!c.id.startsWith('lash')) continue; const t = (fam[c.id] ??= { checked: 0, failed: 0 }); t.checked++; if (!c.ok) t.failed++; }
const iris = JSON.parse(readFileSync('references/eyes/measures-iris-colour.json', 'utf8')) as { summary: unknown; eyes: { id: string; confidence: string; humanReview?: string }[] };
const d = distinctness();
writeFileSync(`${OUT}/08-rapport-passe5.json`, JSON.stringify({
  encre: { moteurAvant: { couleur: '#120e18', luminance: 14 }, moteurMaintenant: { couleur: LASH_INK_COLOR, luminanceRendue: 'voir verifierPixels familles : lash-ink-dark' }, references: { '12': 2, '13': 0, '15': 0, '16': 1, note: 'luminance médiane de l’encre (pixels < 110), mesurée sur references/eyes/*' } },
  cilsSurOuverture: { avantDegagement: 848, apresRotationSeule: 24, maintenant: 0, methode: 'rotation ≤ 50°, puis raccourcissement, puis amincissement, puis omission (8 cils du bas dont la racine est dans la fente)' },
  galerie100: { distanceMinAuxExistants: d.minToExisting, distanceMinEntreLes100: d.minAmongNew, quotasParStyle: rec.reduce<Record<string, number>>((a, r) => ({ ...a, [r.style]: (a[r.style] ?? 0) + 1 }), {}) },
  verifierPixelsGalerie100: tally, verifierPixelsFamilles10x8: fam,
  irisCouleurMesures: { resume: iris.summary, yeux: iris.eyes.map((e) => ({ id: e.id, confiance: e.confidence, relecture: e.humanReview })) },
}, null, 1));
console.log('artefacts passe 5 OK');
