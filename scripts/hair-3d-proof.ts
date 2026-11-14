import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePngRgba } from '../src/core/png';
import { defaultFrame, renderHead } from '../src/head-turntable';
import * as fromHost from '../src/head-turntable/engines/from-host';
import { variedHead } from '../src/head-turntable/engines/from-face';
import type { TurnRender } from '../src/head-turntable';
import { subjectOf } from './hair-volume/subject';
import type { CleanStyle } from './lib/hair-faces';

/**
 * Preuves visuelles de la coiffure 3D (`docs/HAIR-3D-PROOF.md`) : `npx tsx scripts/hair-3d-proof.ts <dossier> [graine=9000]`.
 * Le MÊME script produit les images « avant » (commit de départ) et « après » : seuls les moteurs importés changent (`variedHairedHead` n'existe qu'après).
 *  - hairs-360.png : 10 coiffures × 6 angles (0°, 45°, 90°, 135°, 180°, 270°), tangage 8° ;
 *  - details.png   : gros plans (frange et tempe, épis, rasé, tresse, queue, long de face) ;
 *  - variety.png   : planche de variété (graines 1 – 8) de face, 3/4 et de dos.
 */
const [outDir = 'artefacts/hair-3d/apres', seedArg = '9000'] = process.argv.slice(2);
const seed = Number(seedArg);
mkdirSync(outDir, { recursive: true });
const STYLES = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'] as CleanStyle[];
const BG = [244, 242, 238] as const;

function sheet(rows: TurnRender[][], gap = 6): { w: number; h: number; d: Uint8Array } {
  const cw = Math.max(...rows.flat().map((t) => t.w)), ch = Math.max(...rows.flat().map((t) => t.h)), cols = Math.max(...rows.map((r) => r.length));
  const W = cols * (cw + gap), H = rows.length * (ch + gap), buf = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { buf[i * 4] = BG[0]; buf[i * 4 + 1] = BG[1]; buf[i * 4 + 2] = BG[2]; buf[i * 4 + 3] = 255; }
  rows.forEach((row, ri) => row.forEach((t, ci) => {
    const ox = ci * (cw + gap) + Math.floor((cw - t.w) / 2), oy = ri * (ch + gap) + Math.floor((ch - t.h) / 2);
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
      const a = t.rgba[(y * t.w + x) * 4 + 3]! / 255, d = ((oy + y) * W + ox + x) * 4;
      for (let c = 0; c < 3; c++) buf[d + c] = Math.round(t.rgba[(y * t.w + x) * 4 + c]! * a + buf[d + c]! * (1 - a));
    }
  }));
  return { w: W, h: H, d: buf };
}
const save = (name: string, rows: TurnRender[][]): void => { const s = sheet(rows); writeFileSync(`${outDir}/${name}.png`, encodePngRgba(s.w, s.h, s.d)); console.log(`${outDir}/${name}.png ${s.w}x${s.h}`); };
const view = (spec: Parameters<typeof renderHead>[1], yaw: number, pitch: number, size: number): TurnRender => renderHead({ yaw, pitch }, spec, { frame: defaultFrame(size), ss: 2 });

// 1. 10 coiffures × 6 angles
save('hairs-360', STYLES.map((st) => { const s = subjectOf(st, 1, { seed }).spec; return [0, 45, 90, 135, 180, 270].map((yaw) => view(s, yaw, 8, 260)); }));

// 2. Gros plans : une rangée par sujet, vues choisies pour montrer le détail.
const D: [CleanStyle, number[]][] = [['short', [0, 30, 60]], ['spiky', [0, 40, 180]], ['buzz', [0, 60, 90]], ['braids', [0, 60, 180]], ['ponytail', [0, 60, 150]], ['long', [0, 60, 180]]];
save('details', D.map(([st, yaws]) => { const s = subjectOf(st, 1, { seed }).spec; return yaws.map((yaw) => view(s, yaw, 8, 520)); }));

// 3. Planche de variété : « après » = `variedHairedHead` (volume du visage de la graine) ; « avant » = `variedHead` (calotte courte, sans volume).
const varied = (fromHost as { variedHairedHead?: typeof variedHead }).variedHairedHead ?? variedHead;
save('variety', [1, 2, 3, 4, 5, 6, 7, 8].map((sd) => { const s = varied(sd).spec; return [0, 55, 180].map((yaw) => view(s, yaw, 8, 260)); }));
