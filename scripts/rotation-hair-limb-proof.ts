import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { faceLandmarks } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { posedFace, posedOutline, poseHair } from '../src/face/pose';
import { densifyOpen } from '../src/face/pose/hair-pose-lines';
import { outlinePath } from '../src/face';
import { FaceParams } from '../src/schema';
import { hairFace, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de la lisière sous pose consciente du limbe : `docs/ROTATION-HAIR-LIMB.md`. `npx tsx scripts/rotation-hair-limb-proof.ts [dossier]`.
 *  01 : ligne d'implantation AVANT (projection point par point, rouge) et APRÈS (`poseHair`, vert) sur la silhouette posée du crâne, 4 graines × 6 lacets, recadré sur le haut de la tête ;
 *  02 : agrandissement de la tempe du côté qui passe derrière l'horizon (±45°, ±60°), points de la ligne posée visibles.
 */
const OUT = process.argv[2] ?? 'artefacts/rotation-hair-limb';
mkdirSync(OUT, { recursive: true });
const png = (svg: string, w: number): Buffer => new Resvg(svg, { fitTo: { mode: 'width', value: w }, background: '#ffffff' }).render().asPng() as Buffer;
const setup = (style: CleanStyle, seed: number) => {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), g0 = hairGeometry(params, lm)!;
  return { lm, g0 };
};
const path = (pts: readonly { x: number; y: number }[]): string => `M${pts.map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('L')}`;

const SEEDS = [9000, 9002, 9004, 9005], YAWS = [-60, -45, -30, 30, 45, 60], CW = 330, CH = 270;
{
  const cells: string[] = [];
  SEEDS.forEach((seed, r) => YAWS.forEach((yaw, c) => {
    const { lm, g0 } = setup('short', seed), P = posedFace(lm, yaw), g = poseHair(g0, P.skull, yaw, lm.W);
    const before = densifyOpen(g0.hairline, 0.006 * lm.W).map((q) => ({ x: P.skull.projectX(q.x, q.y, yaw), y: q.y }));
    const x0 = -0.64 * lm.W, y0 = -lm.H / 2 - 8, w = 1.28 * lm.W, h = lm.browLimitY + 30 - y0, s = Math.min(CW / w, CH / h);
    cells.push(`<g transform="translate(${CW * c} ${CH * r}) scale(${s}) translate(${-x0} ${-y0})">
      <path d="${outlinePath(posedOutline(lm, P))}" fill="#f1ece6" stroke="#8a8a8a" stroke-width="${1.2 / s}"/>
      <path d="${path(before)}" fill="none" stroke="#e03030" stroke-width="${1.3 / s}" stroke-linejoin="round"/>
      <path d="${path(g.hairline)}" fill="none" stroke="#12a150" stroke-width="${1.6 / s}" stroke-linejoin="round"/></g>
      <text x="${CW * c + 6}" y="${CH * r + 14}" font-size="12" font-family="monospace" fill="#222">${seed} · ${yaw}°</text>`);
  }));
  writeFileSync(`${OUT}/01-lisiere-avant-apres.png`, png(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW * YAWS.length}" height="${CH * SEEDS.length}"><rect width="100%" height="100%" fill="#fff"/>${cells.join('')}</svg>`, 1980));
}
{
  const cells: string[] = [], Z = 330;
  [[9000, 45], [9004, 45], [9005, -45], [9002, 60]].forEach(([seed, yaw], c) => {
    const { lm, g0 } = setup('short', seed as number), P = posedFace(lm, yaw as number), g = poseHair(g0, P.skull, yaw as number, lm.W);
    const before = densifyOpen(g0.hairline, 0.006 * lm.W).map((q) => ({ x: P.skull.projectX(q.x, q.y, yaw as number), y: q.y }));
    // Tempe du côté qui passe derrière l'horizon : la fin de ligne où la pente est la plus écrasée.
    const end = Math.sign(yaw as number) > 0 ? g.hairline[g.hairline.length - 1]! : g.hairline[0]!, half = 55, s = Z / (2 * half);
    cells.push(`<g transform="translate(${Z * c} 0) scale(${s}) translate(${-(end.x - half)} ${-(end.y - half)})">
      <path d="${outlinePath(posedOutline(lm, P))}" fill="#f1ece6" stroke="#8a8a8a" stroke-width="${1.2 / s}"/>
      <path d="${path(before)}" fill="none" stroke="#e03030" stroke-width="${1.4 / s}"/>
      <path d="${path(g.hairline)}" fill="none" stroke="#12a150" stroke-width="${1.6 / s}"/>
      ${g.hairline.map((q) => `<circle cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="${1.4 / s}" fill="#0b6b36"/>`).join('')}</g>
      <text x="${Z * c + 6}" y="14" font-size="12" font-family="monospace" fill="#222">${seed} · ${yaw}°</text>`);
  });
  writeFileSync(`${OUT}/02-tempe-derriere-horizon.png`, png(`<svg xmlns="http://www.w3.org/2000/svg" width="${Z * 4}" height="${Z}"><rect width="100%" height="100%" fill="#fff"/>${cells.join('')}</svg>`, 1320));
}
console.log(`artefacts écrits dans ${OUT}/`);
