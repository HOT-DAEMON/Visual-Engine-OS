import { readFileSync, writeFileSync } from 'node:fs';
import { rasterPng } from './lib/raster';

/** Assemble avant / après (têtes 3D complètes à 30°) avec les débordements mesurés par différence de rendus (`scripts/nose-refs/alar-overflow.ts`, 420 px). Usage : <avant.png> <après.png> <sortie.png> */
const [av, ap, out] = process.argv.slice(2) as [string, string, string];
const lab = ['plat-trapèze · graine 77', 'plat-trapèze · graine 11', 'plat-trapèze · graine 1203', 'pyramide · graine 77'];
const before = [0.0625, 0.0375, 0.0208, 0.0208], after = [0, 0, 0, 0];
const b64 = (p: string): string => readFileSync(p).toString('base64');
const T = (x: number, y: number, s: string, w = 400): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="13" font-weight="${w}" fill="#222">${s}</text>`;
const row = (src: string, y: number, title: string, v: number[]): string => `${T(6, y + 16, title, 700)}<image x="0" y="${y + 22}" width="1200" height="380" href="data:image/png;base64,${b64(src)}"/>${v.map((d, j) => T(j * 300 + 10, y + 412, `${lab[j]} : débordement de l'aile lointaine ${d.toFixed(4)} U`, 400)).join('')}`;
writeFileSync(out, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="860"><rect width="100%" height="100%" fill="#ece6dc"/>${row(av, 0, 'AVANT (commit 38f254d)', before)}${row(ap, 430, 'APRÈS (aile posée sur la joue + contrainte de contour à 30°)', after)}</svg>`));
console.log('ok');
