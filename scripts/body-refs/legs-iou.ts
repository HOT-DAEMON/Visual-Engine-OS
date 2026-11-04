/**
 * Fidélité des JAMBES à ref-02 (itération 06) : IoU de silhouette dans la région y ≥ crotchY (bras exclus : sous les bouts des doigts tout est jambes ; au-dessus seulement |x − centerX| ≤ 118),
 * erreur de largeur par ligne, et positions verticales (genou, cheville, sol) mesurées sur le masque. Alignement identique à `iou.ts` (une hauteur de tête, base du cou).
 * `npx tsx scripts/body-refs/legs-iou.ts [archétype…]`
 */
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { BG, bodyHost } from '../lib/body-host';
import { fitToRef, loadRef, type Fit, type Ref } from './iou';

export interface LegsIou { readonly iou: number; readonly rowErr: number; readonly widthRatio: number; readonly bottomRef: number; readonly bottomMot: number; readonly kneeWRef: number; readonly kneeWMot: number; readonly thighWRef: number; readonly thighWMot: number }
const run = (m: Uint8Array, w: number, y: number, x0: number, x1: number): [number, number] => { let a = w, b = -1; for (let x = x0; x < x1; x++) if (m[y * w + x]) { a = Math.min(a, x); b = Math.max(b, x); } return [a, b]; };
export function legsIou(ref: Ref, f: Fit): LegsIou {
  const { w, meas } = ref, cx = meas.centerX as number, y0 = meas.crotchY as number, yE = 866, fy = meas.fingertipY as number;
  const inR = (x: number, y: number): boolean => y >= y0 && y < yE && (y > fy + 8 || Math.abs(x - cx) <= 118);
  let n = 0, u = 0, re = 0, rn = 0, bR = 0, bM = 0;
  for (let y = y0; y < yE; y++) {
    let any = false;
    for (let x = 0; x < w; x++) { if (!inR(x, y)) continue; const a = ref.m[y * w + x]!, b = f.mask[y * w + x]!; if (a || b) u++; if (a && b) n++; if (a) { bR = Math.max(bR, y); any = true; } if (b) bM = Math.max(bM, y); }
    if (any) { const [a0, a1] = run(ref.m, w, y, 0, w), [b0, b1] = run(f.mask, w, y, 0, w); if (a1 > 0 && b1 > 0 && y > fy + 8) { re += Math.abs(b1 - b0 - (a1 - a0)) / (a1 - a0); rn++; } }
  }
  // Largeurs de repère (deux jambes) : cuisse à 30 % crotch→sol, genou à 62 %.
  const span = (m: Uint8Array, y: number): number => { const [a, b] = run(m, w, y, 0, w); return b - a; };
  const yk = Math.round(y0 + 0.62 * (bR - y0)), yt = Math.round(y0 + 0.3 * (bR - y0));
  return { iou: n / Math.max(1, u), rowErr: re / Math.max(1, rn), widthRatio: 0, bottomRef: bR, bottomMot: bM, kneeWRef: span(ref.m, yk), kneeWMot: span(f.mask, yk), thighWRef: span(ref.m, yt), thighWMot: span(f.mask, yt) };
}
if (process.argv[1]?.endsWith('legs-iou.ts')) {
  const H = bodyHost(), ref = loadRef('ref-02'), names = process.argv.slice(2).length ? process.argv.slice(2) : ['adultMale', 'muscular', 'veryMuscular'];
  void BG;
  for (const n of names) { const r = legsIou(ref, fitToRef(ref, ARCHETYPES[n as keyof typeof ARCHETYPES] as BodyInput, H.a, H.skin)); console.log(n.padEnd(13), `IoU jambes ${r.iou.toFixed(3)}  erreur de largeur/ligne ${r.rowErr.toFixed(3)}  sol ref ${r.bottomRef} / moteur ${r.bottomMot}  cuisses ref ${r.thighWRef} / moteur ${r.thighWMot}  genoux ref ${r.kneeWRef} / moteur ${r.kneeWMot}`); }
}
