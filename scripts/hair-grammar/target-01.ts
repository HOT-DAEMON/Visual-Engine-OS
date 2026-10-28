import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import type { FaceLayer, FitTarget } from '../../src/hair-grammar/autofit';
import { drawFace } from '../../src/hair-grammar/face3q';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { VIEW_01 } from '../../src/hair-grammar/views';
import { silhouette } from '../../src/hair-grammar/verify';
import { decodePng } from '../../src/regression/png';

/** Cible d'ajustement de la cellule 01 (référence réduite à l'échelle `s`) et calque de visage statique. Partagé par fit-01 et les tests. */
export const ROI = { w: 156, h: 150 };

export function makeTarget01(S = 2): { target: FitTarget; layer: FaceLayer } {
  const ref4 = decodePng(readFileSync('artefacts/hair-grammar/refs/h01-roi-x4.png'));
  const W = ROI.w * S; const H = ROI.h * S; const k = ref4.width / W;
  const refGray = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) a += ref4.data[((y * k + j) * ref4.width + x * k + i) * 4] as number; refGray[y * W + x] = Math.round(a / (k * k)); }
  const refInside = silhouette({ w: W, h: H, data: refGray });
  const target: FitTarget = { s: S, w: ROI.w, h: ROI.h, refGray, inkRows: 132, silRows: 108, refInside };
  const face = drawFace(TOUSLED.head, VIEW_01);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ROI.w} ${ROI.h}" width="${W}" height="${H}">${face.neckBack}${face.ear}${face.skin}${face.lines}${face.eyes}</svg>`;
  const px = new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels;
  const alpha = new Uint8Array(W * H); const gray = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { alpha[i] = px[i * 4 + 3] as number; gray[i] = Math.round(0.299 * (px[i * 4] as number) + 0.587 * (px[i * 4 + 1] as number) + 0.114 * (px[i * 4 + 2] as number)); }
  return { target, layer: { alpha, gray } };
}
