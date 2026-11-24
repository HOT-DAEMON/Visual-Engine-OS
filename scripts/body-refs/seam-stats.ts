/**
 * MESURES DU FONDU DE NORMALES (itération 07) : `npx tsx scripts/body-refs/seam-stats.ts <fichier.json>`
 * Pour 5 archétypes × 3 lacets : pixels fondus, saut moyen de normale (degrés) aux raccords peau/peau AVANT puis APRÈS le fondu, et part des pixels du corps dont la luminance change.
 */
import { writeFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes, renderVolumesPixel } from '../../src/body/volume';
import { bodyHost } from '../lib/body-host';

const H = bodyHost(), rows: unknown[] = [];
for (const a of ['adultMale', 'veryMuscular', 'adultFemale', 'child', 'obese']) for (const yaw of [0, 40, 180]) {
  const set = bodyVolumes((ARCHETYPES as Record<string, unknown>)[a] as BodyInput, H.a, {}), cam = { yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
  const on = renderVolumesPixel(set, { skin: H.skin, heightPx: 460, camera: cam, uid: 's1' }), off = renderVolumesPixel(set, { skin: H.skin, heightPx: 460, camera: cam, uid: 's0', seamBlend: false });
  let solid = 0, changed = 0, sum = 0; for (let i = 0; i < on.pixels.rgba.length; i += 4) { if (on.pixels.rgba[i + 3]! > 200) solid++; const d = Math.abs(on.pixels.rgba[i]! - off.pixels.rgba[i]!); if (d > 0) { changed++; sum += d; } }
  rows.push({ archetype: a, yaw, blendedPixels: on.seam.blended, meanJumpBeforeDeg: +on.seam.jumpBefore.toFixed(1), meanJumpAfterDeg: +on.seam.jumpAfter.toFixed(1), ratio: +(on.seam.jumpAfter / on.seam.jumpBefore).toFixed(2), bodyPixelsChangedPct: +((100 * changed) / solid).toFixed(2), meanLumaChange255: +(sum / Math.max(1, changed)).toFixed(1) });
}
writeFileSync(process.argv[2] ?? '/tmp/seam.json', JSON.stringify(rows, null, 1));
console.table(rows);
