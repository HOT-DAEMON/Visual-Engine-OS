import { mkdirSync, writeFileSync } from 'node:fs';
import { EXTRA_EYE_COUNT, distinctness, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { eyeSheetPng } from './lib/eye-sheet';
import type { SceneInput } from '../src/schema';

/** Galerie des 100 yeux supplémentaires : `npx tsx scripts/gallery-eyes-100.ts` -> examples/gallery-100.json + artefacts/eyes-100/01-galerie-100-yeux.png (+ planches par style). */
const OUT = 'artefacts/eyes-100';
const COLS = 10, CELL_X = 240, CELL_Y = 200, TARGET_WIDTH = 150;
mkdirSync(OUT, { recursive: true }); mkdirSync('examples', { recursive: true });
const scaled = (i: number) => { const e = generateExtraEye(i); const w = (e.shape?.width ?? 240); const k = TARGET_WIDTH / w; return { ...e, eyebrow: null, shape: { ...e.shape, width: w * k, height: (e.shape?.height ?? 120) * k } }; };
const rc = extraEyeRecipes();
const objects: SceneInput['objects'] = Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => ({ ...scaled(i), id: `extra-${i}`, transform: { x: CELL_X / 2 + (i % COLS) * CELL_X, y: CELL_Y / 2 + 14 + Math.floor(i / COLS) * CELL_Y } })) as SceneInput['objects'];
writeFileSync('examples/gallery-100.json', JSON.stringify({ width: COLS * CELL_X, height: Math.ceil(EXTRA_EYE_COUNT / COLS) * CELL_Y, background: '#eec9ad', label: `Galerie : ${EXTRA_EYE_COUNT} yeux supplémentaires (12 enveloppes, recettes déterministes ; voir src/generation/eye-gallery-ext.ts)`, objects }, null, 2));
const cells = rc.map((r, i) => ({ label: `${i} ${r.style} h/l ${r.aspect.toFixed(2)} ${r.tiltDeg.toFixed(0)}°`, eye: scaled(i) as Record<string, unknown>, background: '#2b2f3f' }));
writeFileSync(`${OUT}/01-galerie-100-yeux.png`, eyeSheetPng(cells, COLS, CELL_X, CELL_Y));
console.log('distinctness', JSON.stringify(distinctness()));
