/**
 * Gros plans de l'oreille et de la mâchoire / du cou (preuves visuelles de l'intégration des moteurs).
 *   OUT=artefacts/head-turntable-engines npx tsx scripts/head-turntable/artefacts-engines.ts
 * Écrit ear_yaw_XXX.png et jaw_yaw_XXX.png dans $OUT/gros-plans ; `compose-engines.py` les assemble avec l'avant.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePngRgba } from '../../src/core/png';
import { defaultFrame, REF_SPEC, refView, renderHead, REGION } from '../../src/head-turntable';

const OUT = `${process.env.OUT ?? 'artefacts/head-turntable-engines'}/gros-plans`;
mkdirSync(OUT, { recursive: true });
const fr = defaultFrame(1400);
const crop = (rgba: Uint8ClampedArray, w: number, x0: number, y0: number, x1: number, y1: number): Uint8ClampedArray => {
  const cw = x1 - x0, ch = y1 - y0, o = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let c = 0; c < 4; c++) o[(y * cw + x) * 4 + c] = rgba[((y0 + y) * w + x0 + x) * 4 + c]!;
  return o;
};
for (const yaw of [0, 45, 90, 135, 160]) {
  const r = renderHead(refView(yaw), REF_SPEC, { frame: fr, ss: 2 });
  let x0 = r.w, x1 = 0, y0 = r.h, y1 = 0, top = r.h, bot = 0;
  for (let k = 0; k < r.w * r.h; k++) {
    if (!r.ids[k]) continue; const x = k % r.w, y = (k - x) / r.w; top = Math.min(top, y); bot = Math.max(bot, y);
    if (r.regions[k] === REGION.ear && (yaw % 180 !== 0 || x > r.originX)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const m = Math.round((y1 - y0) * 0.35), E = [Math.max(0, x0 - m), Math.max(0, y0 - m), Math.min(r.w, x1 + m), Math.min(r.h, y1 + m)] as const;
  writeFileSync(`${OUT}/ear_yaw_${String(yaw).padStart(3, '0')}.png`, encodePngRgba(E[2] - E[0], E[3] - E[1], crop(r.rgba, r.w, ...E)));
  const jt = Math.round(top + (bot - top) * 0.5), J = [Math.round(r.w * 0.1), jt, Math.round(r.w * 0.9), Math.min(r.h, bot + 8)] as const;
  writeFileSync(`${OUT}/jaw_yaw_${String(yaw).padStart(3, '0')}.png`, encodePngRgba(J[2] - J[0], J[3] - J[1], crop(r.rgba, r.w, ...J)));
}
console.log('gros plans écrits dans', OUT);
