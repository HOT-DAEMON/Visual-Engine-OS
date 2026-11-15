import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { EXTRA_EYE_COUNT, extraEyeLashFamily, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { LASH_FAMILIES, LASH_FAMILY_IDS, applyLashFamily } from '../src/generation/eye-lash-families';
import { verifyEye } from '../src/verify/eye';
import { eyeSheetPng } from './lib/eye-sheet';
import { layout, render } from './lib/proof';

/**
 * Artefacts « cils » : `npx tsx scripts/artefacts-eyes-lashes.ts` puis `python3 scripts/eye-refs/compose_lash_panel.py` (06, références contre moteur).
 *   03 familles (10 × 2 yeux + œil sans cils) · 04 galerie des 100 avec familles (échelle par œil : plus de sprites hauts rognés) · 05 paramètres bendDeg / rootFuse / span consommés
 *   07 rapport de vérification des cils (yeux de galerie, familles, défauts) · 08 têtes entières avec famille de cils tirée (generateRandomFace lashFamily: 'auto').
 */
const OUT = 'artefacts/eyes-refs3'; mkdirSync(OUT, { recursive: true }); mkdirSync('/tmp/x', { recursive: true });
const at = (e: Record<string, unknown>, x: number, y: number, s: number): Record<string, unknown> => ({ ...e, transform: { x, y, scale: s } });
const bare = (e: Record<string, unknown>) => ({ ...e, lashes: { upper: { count: 0, flick: { count: 0 } }, lower: { count: 0 } } });
const noBrow = (i: number) => ({ ...generateExtraEye(i), eyebrow: null }) as Record<string, unknown>;

// ---- 03 : familles (cellule 300 x 230, œil à l'échelle 0,6 : cils compris dans la cellule) ----
const CW = 300, CH = 230;
const rows = [6, 40].map((i) => [{ label: `œil ${i} · sans cils`, eye: at(bare(noBrow(i)), CW / 2, CH * 0.55, 0.6) }, ...LASH_FAMILY_IDS.map((id) => ({ label: `œil ${i} · ${LASH_FAMILIES[id].label}`, eye: at(applyLashFamily(noBrow(i), id), CW / 2, CH * 0.55, 0.6) }))]);
writeFileSync(`${OUT}/03-familles-de-cils.png`, eyeSheetPng(rows.flat(), 6, CW, CH));
for (const i of [6, 40]) writeFileSync(`/tmp/x/row-eye${i}.png`, eyeSheetPng(LASH_FAMILY_IDS.map((id) => ({ label: id, eye: at(applyLashFamily(noBrow(i), id), CW / 2, CH * 0.55, 0.6) })), 10, CW, CH, false));
void rows;

// ---- 04 : galerie des 100, échelle par œil (hauteur ET largeur de cils comprises) ----
const gal = Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => {
  const e = noBrow(i) as { shape: { width: number; height: number } }; const f = extraEyeLashFamily(i);
  const s = Math.min(0.6, 138 / (e.shape.height * 1.6), 215 / (e.shape.width * 1.6));
  return { label: `#${i} · ${f ?? 'cils d’origine'} · ×${s.toFixed(2)}`, eye: at(e as never, 115, 92, s) };
});
writeFileSync(`${OUT}/04-galerie-100-familles-de-cils.png`, eyeSheetPng(gal, 10, 230, 175));

// ---- 05 : paramètres consommés (bas vs haut) ----
const INK = { material: { base: { type: 'solid', color: '#120e18' }, roughness: 0.6 }, opacity: 1, gloss: 0, colorVariation: 0 };
const baseEye = { ...noBrow(6), lids: { ...((noBrow(6).lids as object) ?? {}), thickness: 0.1 } } as Record<string, unknown>;
const G0 = { count: 12, length: 0.28, thickness: 1.5, curl: 0.4, sweep: 40, tipSharpness: 0.9, rootFuse: 1 };
const v = (label: string, up: Record<string, unknown>) => ({ label, eye: at({ ...baseEye, lashes: { upper: { ...INK, ...G0, ...up }, lower: { count: 0 } } }, CW / 2, CH * 0.58, 0.6) });
const sweeps = [
  v('bendDeg −35', { bendDeg: -35 }), v('bendDeg 0 (historique)', { bendDeg: 0, rootFuse: 0 }), v('bendDeg 20', { bendDeg: 20 }), v('bendDeg 40', { bendDeg: 40 }), v('bendDeg 60', { bendDeg: 60 }),
  v('rootFuse 0', { bendDeg: 35, rootFuse: 0 }), v('rootFuse 0,5', { bendDeg: 35, rootFuse: 0.5 }), v('rootFuse 1', { bendDeg: 35, rootFuse: 1 }), v('curl 0,1 (courbure tardive)', { bendDeg: 45, curl: 0.1 }), v('curl 0,9 (courbure précoce)', { bendDeg: 45, curl: 0.9 }),
  v('span 0,05–0,95', { bendDeg: 35 }), v('span 0,6–0,98', { bendDeg: 35, span: { from: 0.6, to: 0.98 } }), v('span 0,35–0,98', { bendDeg: 35, span: { from: 0.35, to: 0.98 } }), v('clump 0,9 + bend', { bendDeg: 35, clump: 0.9, clumpSize: 3 }), v('flick + bend', { bendDeg: 35, flick: { count: 3, length: 0.6, reach: 0.18, liftDeg: 26, curl: 0.7 } }),
];
writeFileSync(`${OUT}/05-parametres-cils-consommes.png`, eyeSheetPng(sweeps, 5, CW, CH));

// ---- 07 : vérification des cils ----
const tally: Record<string, { checked: number; failed: number; severity: string }> = {};
const run = (eye: unknown): void => { for (const c of verifyEye(eye).checks.filter((k) => /lash/.test(k.id))) { const t = (tally[c.id] ??= { checked: 0, failed: 0, severity: c.severity }); t.checked++; if (!c.ok) t.failed++; } };
for (let i = 0; i < EXTRA_EYE_COUNT; i++) run(generateExtraEye(i));
const galleryTally = JSON.parse(JSON.stringify(tally)) as typeof tally; for (const k of Object.keys(tally)) delete tally[k];
const famEyes = [3, 6, 12, 25, 40, 58, 77, 91]; for (const i of famEyes) for (const id of LASH_FAMILY_IDS) run(applyLashFamily(generateExtraEye(i) as never, id));
writeFileSync(`${OUT}/07-verification-cils.json`, JSON.stringify({ galerie100: galleryTally, familles10x8yeux: tally, note: 'checked = nombre d’yeux où le contrôle s’applique ; failed = échecs (severity error = bloquant, warn = signalé). Défauts injectés : tests/eye-lash-verify.test.ts.' }, null, 1));

// ---- 08 : têtes entières, famille de cils tirée (flux dérivé dédié), identités étendues ----
const ids = [15, 22, 31, 47, 58, 64, 71, 80, 88, 93, 97, 99].map((k) => 48 + k);
const L = layout(ids.length, 4, 300, 520, 0.62, (i) => ({ seed: 1200 + i * 11, opts: { eyeSource: 'extended', identity: ids[i], lashFamily: 'auto' } as never }));
writeFileSync(`${OUT}/08-tetes-avec-familles-de-cils.png`, render(L.objects as never, 1200, 1560, '', '#3b4157', 1200));
const heads = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4242, opts: { eyeSource: 'extended', identity: 48 + 22, lashFamily: 'fin-feminin' } as never }));
writeFileSync(`${OUT}/09-tete-gros-plan-fin-feminin.png`, render(heads.objects as never, 700, 900, '', '#3b4157', 700));
void compileScene; void Resvg;
console.log('artefacts cils OK');
