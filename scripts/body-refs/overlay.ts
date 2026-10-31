/** Superposition silhouette référence (rouge) / moteur (vert) ; recouvrement = jaune. `npx tsx scripts/body-refs/overlay.ts <archetype> <out.png>` */
import { writeFileSync } from 'node:fs';
import { encodePngRgba } from '../../src/core/png';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyHost } from '../lib/body-host';
import { fitToRef, loadRef, silhouetteIou } from './iou';

export function overlayPng(ref: ReturnType<typeof loadRef>, mask: Uint8Array): Buffer {
  const { w, h } = ref, px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const a = ref.m[i]!, b = mask[i]!; px.set(a && b ? [235, 215, 60, 255] : a ? [220, 60, 60, 255] : b ? [60, 200, 90, 255] : [28, 30, 40, 255], i * 4); }
  return encodePngRgba(w, h, px);
}
if (process.argv[1]?.endsWith('overlay.ts')) {
  const H = bodyHost(), ref = loadRef(), n = (process.argv[2] ?? 'veryMuscular') as keyof typeof ARCHETYPES;
  const f = fitToRef(ref, ARCHETYPES[n] as BodyInput, H.a, H.skin);
  writeFileSync(process.argv[3] ?? '/tmp/overlay.png', overlayPng(ref, f.mask));
  console.log(silhouetteIou(ref, f));
}
