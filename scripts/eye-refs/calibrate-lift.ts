import { readFileSync } from 'node:fs';
import { mulberry32 } from '../../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../../src/generation/eye-iris-families-photo2';
import { irisTone } from '../lib/eye-iris-tone';

/** Calibre `iris.lift` (gamma des demi-teintes) de chaque famille photo 2 par bissection sur la LUMINANCE MOYENNE mesurée de la référence (`npx tsx scripts/eye-refs/calibrate-lift.ts [famille]`) ; la vibrance est recalibrée dans la foulée (`calibrate-vibrance.ts`). Valeurs reportées à la main dans `eye-iris-families-photo2.ts`. */
const J = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as any[];
const rc2 = extra2Recipes(); const baseIdx = rc2.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const only = process.argv[2];
PHOTO2_IRIS_FAMILIES.forEach((f, i) => {
  if (only && f !== only) return;
  const ref = J.find((x) => x.id === PHOTO2_IRIS_MEASURES[f].ref).tone; const target = ref.lumMean as number;
  const tone = (l: number) => irisTone(applyIrisPreset(generateExtra2Eye(baseIdx) as never, { ...photoIrisFamily2(f, mulberry32(7 + i)), lift: l }, 'almond', false) as never);
  const t0 = tone(0); let lo = 0, hi = 1;
  if (t0.lumMean >= target) { console.log(f, 'lum', t0.lumMean, '>= cible', target, '-> lift 0'); return; }
  for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (tone(m).lumMean < target) lo = m; else hi = m; }
  const l = Math.round(((lo + hi) / 2) * 100) / 100; const t = tone(l);
  console.log(f, 'cible', target, 'lift', l, 'obtenu lum', t.lumMean, 'part sombre', t.darkShare, '(réf', ref.darkShare + ')', 'pics', t.satPeaks, '(réf', ref.satPeaks + ')');
});
