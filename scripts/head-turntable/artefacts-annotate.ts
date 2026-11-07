import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contour de la mâchoire annoté (audit pixel) : chaque échantillon du contour de la tête (pas 0,006 U) est dessiné par-dessus le rendu, coloré par courbure —
 * vert : convexe doux (rayon > 0,08 U) · orange : convexe serré (0,03 – 0,08 U) · rouge : angle vif (< 0,03 U) · bleu : concave (creux, inflexion) · gris : contre une autre pièce.
 * Exécutable dans n'importe quel arbre (process.cwd()). Usage : tsx artefacts-annotate.ts <dossier de sortie> [yaws séparés par des virgules]
 */
const out = process.argv[2] ?? '/tmp/annot', yaws = (process.argv[3] ?? '20,45,70,90,135').split(',').map(Number), root = process.cwd();
const load = async (p: string): Promise<any> => import(join(root, p));
const { encodePngRgba } = await load('src/core/png'), T = await load('src/head-turntable'), C = await load('src/head-turntable/verify-contour');
mkdirSync(out, { recursive: true });
for (const yaw of yaws) {
  const r = T.renderHead(T.refView(yaw), T.REF_SPEC, { frame: T.defaultFrame(1000), ss: 2 });
  const pts = C.headContour(r, 0.006), k = C.curvature(pts, 3, 0.006);
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a.x * b.y - b.x * a.y; }
  const sign = Math.sign(area) || 1, rgba = new Uint8ClampedArray(r.w * r.h * 4);
  for (let i = 0; i < r.w * r.h; i++) { const a = r.rgba[4 * i + 3]! / 255; for (let c = 0; c < 3; c++) rgba[4 * i + c] = Math.round(r.rgba[4 * i + c]! * a * 0.55 + 255 * (1 - a * 0.55)); rgba[4 * i + 3] = 255; }
  pts.forEach((p: any, i: number) => {
    if (p.y < 0.55 || p.y > 1.3) return;
    const c = k[i]! * sign, rad = Math.abs(c) > 1e-6 ? 1 / Math.abs(c) : 9;
    const col = p.kind === 'other' ? [150, 150, 150] : c < -3 ? [30, 90, 230] : rad > 0.08 ? [20, 170, 60] : rad > 0.03 ? [240, 150, 20] : [225, 30, 30];
    const px = Math.round(p.x * r.ppu + r.originX), py = Math.round(p.y * r.ppu + r.originY);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = px + dx, y = py + dy; if (x >= 0 && y >= 0 && x < r.w && y < r.h) { const o = 4 * (y * r.w + x); rgba[o] = col[0]!; rgba[o + 1] = col[1]!; rgba[o + 2] = col[2]!; } }
  });
  writeFileSync(join(out, `annot_${yaw}.png`), encodePngRgba(r.w, r.h, rgba));
}
