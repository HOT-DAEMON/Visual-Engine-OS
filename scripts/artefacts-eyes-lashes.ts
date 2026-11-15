import { mkdirSync, writeFileSync } from 'node:fs';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';
import { LASH_FAMILIES, LASH_FAMILY_IDS, applyLashFamily } from '../src/generation/eye-lash-families';
import { eyeSheetPng } from './lib/eye-sheet';

/** Artefacts « familles de cils » : `npx tsx scripts/artefacts-eyes-lashes.ts` -> artefacts/eyes-refs3/03-familles-de-cils.png (6 familles × 2 yeux de base, sans sourcil, mêmes yeux sans cils en tête de ligne). */
const OUT = 'artefacts/eyes-refs3'; mkdirSync(OUT, { recursive: true });
const bases = [6, 40].map((i) => ({ ...generateExtraEye(i), eyebrow: null }) as Record<string, unknown>);
const bare = (e: Record<string, unknown>) => ({ ...e, lashes: { upper: { count: 0, flick: { count: 0 } }, lower: { count: 0 } } });
const cells = bases.flatMap((b, bi) => [{ label: `œil ${bi + 1} · sans cils`, eye: bare(b) }, ...LASH_FAMILY_IDS.map((id) => ({ label: `œil ${bi + 1} · ${LASH_FAMILIES[id].label}`, eye: applyLashFamily(b, id) }))]);
writeFileSync(`${OUT}/03-familles-de-cils.png`, eyeSheetPng(cells, 7, 330, 250));
console.log(`${OUT}/03-familles-de-cils.png`, cells.length, 'cellules');

// ---- 04 : la galerie des 100 yeux étendus avec leur famille de cils (null = cils d'origine) ----------------------------------------------------------
import { EXTRA_EYE_COUNT, extraEyeLashFamily } from '../src/generation/eye-gallery-ext';
const gal = Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => { const f = extraEyeLashFamily(i); return { label: `#${i} · ${f ?? 'cils d’origine'}`, eye: { ...generateExtraEye(i), eyebrow: null, transform: { x: 115, y: 96, scale: 0.6 } } as Record<string, unknown> }; });   // échelle 0,6 : l'œil (240 de large) tient dans la cellule de 230 px, cils compris
writeFileSync(`${OUT}/04-galerie-100-familles-de-cils.png`, eyeSheetPng(gal, 10, 230, 175));
console.log(`${OUT}/04-galerie-100-familles-de-cils.png`, gal.length, 'yeux,', gal.filter((c) => !c.label.endsWith('d’origine')).length, 'avec famille');
