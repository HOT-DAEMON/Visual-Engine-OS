import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../src';
import { rasterPng } from './lib/raster';
import { noseShot } from '../tests/helpers-nose-material';

/**
 * Preuves visuelles du matériau propre au nez (`skinMaterial.noseDetail`). Deux planches :
 *  01 : gros plan du nez (graine 11), un axe par ligne (tipShine, alarBlush) à 0 / 0,5 / 1, peau seule ;
 *  02 : 3 têtes COMPLÈTES (graines 11, 77, 1203), matériau éteint à gauche, allumé (tipShine 0,8 · alarBlush 0,7) à droite.
 *   npx tsx scripts/artefacts-nose-material.ts
 */
const T = (x: number, y: number, s: string, fs = 14): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fs}" fill="#222">${s}</text>`;
const png = (svg: string): string => new Resvg(svg, { fitTo: { mode: 'width', value: 360 } }).render().asPng().toString('base64');

const rows: [string, (v: number) => object][] = [['tipShine', (v) => ({ tipShine: v })], ['alarBlush', (v) => ({ alarBlush: v })]];
let body = '';
rows.forEach(([n, f], r) => [0, 0.5, 1].forEach((v, c) => { body += `<image x="${c * 360}" y="${30 + r * 372}" width="360" height="360" href="data:image/png;base64,${png(noseShot(11, f(v) as never).svg)}"/>${T(c * 360 + 8, 48 + r * 372, `${n} = ${v}`)}`; }));
writeFileSync('artefacts/nez-materiau/01-gros-plan-axes.png', rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${30 + rows.length * 372}"><rect width="100%" height="100%" fill="#ece6dc"/>${T(8, 20, 'Matériau propre au nez : un axe par ligne (graine 11, gros plan ×2,6, peau seule)', 15)}${body}</svg>`, { fonts: true }));

const head = (seed: number, nd: object): string => {
  const F = generateRandomFace(seed, { id: 'f0', anatomy: { skinMaterial: { noseDetail: nd } } as never, transform: { x: 150, y: 215, scale: 0.72 } });
  const r = compileScene({ width: 300, height: 380, background: '#ece6dc', objects: F.objects } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  return rasterPng(r.svg).toString('base64');
};
let h = '';
[11, 77, 1203].forEach((seed, k) => [['éteint', {}], ['allumé', { tipShine: 0.8, alarBlush: 0.7 }]].forEach(([lab, nd], j) => { h += `<image x="${j * 300}" y="${30 + k * 392}" width="300" height="380" href="data:image/png;base64,${head(seed, nd as object)}"/>${T(j * 300 + 6, 46 + k * 392, `graine ${seed} · matériau ${lab as string}`)}`; }));
writeFileSync('artefacts/nez-materiau/02-tetes-eteint-allume.png', rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${30 + 3 * 392}"><rect width="100%" height="100%" fill="#ece6dc"/>${T(8, 20, 'Têtes complètes : matériau du nez éteint / allumé', 15)}${h}</svg>`, { fonts: true }));
console.log('ok');
