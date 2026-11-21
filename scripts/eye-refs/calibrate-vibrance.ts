/** Calibre `iris.vibrance` de chaque famille photo 2 par bissection sur la saturation des pics MESURÉE de la référence (`npx tsx scripts/eye-refs/calibrate-vibrance.ts`). Les valeurs sont reportées à la main dans `eye-iris-families-photo2.ts` (tests/eye-iris-pass11.test.ts vérifie l'écart ≤ 0,07). */
import { readFileSync } from 'node:fs';
import { mulberry32 } from '../../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../../src/generation/eye-iris-families-photo2';
import { irisTone } from '../lib/eye-iris-tone';
const rc2 = extra2Recipes(); const baseIdx = rc2.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const J = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')); const arr: any[] = Array.isArray(J) ? J : (J.eyes ?? Object.values(J));
const ref = (id: string) => (Array.isArray(J) ? J.find((x: any) => x.id === id) : J[id] ?? arr.find((x) => x.id === id));
PHOTO2_IRIS_FAMILIES.forEach((f, i) => {
  const target = ref(PHOTO2_IRIS_MEASURES[f].ref).tone.satPeaks as number; let lo = 0, hi = 1;
  const sat = (v: number) => irisTone(applyIrisPreset(generateExtra2Eye(baseIdx) as never, { ...photoIrisFamily2(f, mulberry32(7 + i)), vibrance: v }, 'almond', false) as never).satPeaks;
  for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (sat(m) < target) lo = m; else hi = m; }
  console.log(f, 'cible', target, 'vibrance', ((lo + hi) / 2).toFixed(3), 'obtenu', sat(Math.round(((lo + hi) / 2) * 100) / 100));
});
