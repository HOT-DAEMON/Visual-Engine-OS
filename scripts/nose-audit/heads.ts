import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { headShot } from './visibility-lib';
import { rasterPng } from '../lib/raster';

/** Têtes COMPLÈTES (avec cheveux) au bas et au haut d'un axe : `npx tsx scripts/nose-audit/heads.ts <graine> <dossier> path:lo:hi ...` */
const [seedS, dir, ...specs] = process.argv.slice(2);
for (const sp of specs) {
  const [path, lo, hi] = sp.split(':') as [string, string, string];
  const imgs = [lo, hi].map((v) => headShot(Number(seedS), 'structured', { [path]: Number(v) }, { hair: true, scale: 1.0, centerY: 0.56 }));
  const b64 = imgs.map((s) => Buffer.from(new Resvg(s.svg, { fitTo: { mode: 'width', value: s.w } }).render().asPng()).toString('base64'));
  const { w, h } = imgs[0]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * w + 6}" height="${h + 26}"><rect width="100%" height="100%" fill="#ece6dc"/>` +
    `<text x="6" y="18" font-family="sans-serif" font-size="15" fill="#222">${path} : ${lo}  |  ${hi}   (tête complète, graine ${seedS})</text>` +
    b64.map((d, i) => `<image x="${i * (w + 6)}" y="26" width="${w}" height="${h}" href="data:image/png;base64,${d}"/>`).join('') + '</svg>';
  writeFileSync(`${dir}/tete-${seedS}-${path.replace('.', '-')}.png`, rasterPng(svg, { fonts: true }));
  console.log('ok', path);
}
