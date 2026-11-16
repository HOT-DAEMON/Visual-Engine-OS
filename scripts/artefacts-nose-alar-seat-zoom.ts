import { readFileSync, writeFileSync } from 'node:fs';
import { rasterPng } from './lib/raster';

/** Agrandissement ×4 du nez (colonnes 1 et 2 de la planche : plat-trapèze graines 77 et 11), avant en haut, après en bas. Usage : <avant.png> <après.png> <sortie.png> */
const [av, ap, out] = process.argv.slice(2) as [string, string, string];
const b64 = (p: string): string => readFileSync(p).toString('base64');
const crop = (src: string, col: number, x: number, y: number): string => `<svg x="${x}" y="${y}" width="440" height="440" viewBox="${col * 300 + 30} 185 110 110"><image width="1200" height="380" href="data:image/png;base64,${b64(src)}" image-rendering="pixelated"/></svg><rect x="${x}" y="${y}" width="440" height="440" fill="none" stroke="#222" stroke-width="2"/>`;
writeFileSync(out, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="100%" height="100%" fill="#ece6dc"/>${crop(av, 0, 5, 5)}${crop(av, 1, 455, 5)}${crop(ap, 0, 5, 455)}${crop(ap, 1, 455, 455)}</svg>`));
console.log('ok');
