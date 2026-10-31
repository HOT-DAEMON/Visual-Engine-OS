/**
 * CONTOUR SUPÉRIEUR DE L'ÉPAULE mesuré sur une référence, en unités de tête (origine : base du cou, x vers l'extérieur, y vers le bas).
 * Sert à comparer la pente cou → trapèze → acromion → deltoïde du moteur à celle de la référence. `npx tsx scripts/body-refs/contour.ts`.
 */
import { loadRef, fitToRef, type Ref } from './iou';
export interface Contour { readonly x: number[]; readonly y: number[] }
/** Pour chaque colonne (côté gauche de l'image), ordonnée du premier pixel de silhouette sous `y0` ; en unités de tête. */
export function topContour(mask: Uint8Array, ref: Ref, y0: number, y1: number, step = 4): Contour {
  const { w, meas } = ref, head = meas.head.height as number, cx = meas.centerX as number, out: Contour = { x: [], y: [] };
  for (let x = cx - Math.round(0.42 * head); x >= 0; x -= step) {
    let ty = -1;
    for (let y = Math.round(y0); y <= y1; y++) if (mask[y * w + x]) { ty = y; break; }
    if (ty < 0) break;
    out.x.push((cx - x) / head); out.y.push((ty - meas.neckBaseY) / head);
  }
  return out;
}
/** Paroi EXTERNE du bras (côté gauche de l'image) : abscisse extrême par rangée, en unités de tête, de la base du cou au bout des doigts. */
export function outerWall(mask: Uint8Array, ref: Ref, rows: number[]): number[] {
  const { w, meas } = ref, head = meas.head.height as number, cx = meas.centerX as number;
  return rows.map((r) => { const y = Math.round(meas.neckBaseY + r * head); for (let x = 0; x < cx; x++) if (mask[y * w + x]) return (cx - x) / head; return NaN; });
}
if (process.argv[1]?.endsWith('contour.ts')) {
  const { bodyHost } = await import('../lib/body-host'), { ARCHETYPES } = await import('../../src/body');
  const H = bodyHost();
  for (const rn of ['ref-02', 'ref-04'] as const) {
    const ref = loadRef(rn), f = fitToRef(ref, ARCHETYPES.veryMuscular as never, H.a, H.skin), y0 = ref.meas.neckBaseY - 0.2 * ref.meas.head.height;
    const a = topContour(ref.m, ref, y0, ref.meas.neckBaseY + 1.5 * ref.meas.head.height), b = topContour(f.mask, ref, y0, ref.meas.neckBaseY + 1.5 * ref.meas.head.height);
    console.log(rn, 'x(tête)  y_réf  y_moteur  écart');
    for (let i = 0; i < a.x.length; i += 2) console.log(a.x[i]!.toFixed(2).padStart(6), a.y[i]!.toFixed(3).padStart(7), (b.y[i] ?? NaN).toFixed(3).padStart(8), ((b.y[i] ?? NaN) - a.y[i]!).toFixed(3).padStart(7));
  }
  for (const rn of ['ref-02', 'ref-04'] as const) {
    const ref = loadRef(rn), f = fitToRef(ref, ARCHETYPES.veryMuscular as never, H.a, H.skin), rows = Array.from({ length: 33 }, (_, i) => 0.5 + 0.1 * i), a = outerWall(ref.m, ref, rows), b = outerWall(f.mask, ref, rows);
    console.log(rn, 'paroi externe : y(tête sous base)  x_réf  x_moteur');
    rows.forEach((r, i) => console.log(r.toFixed(1).padStart(5), a[i]!.toFixed(2).padStart(6), b[i]!.toFixed(2).padStart(7)));
  }
}
