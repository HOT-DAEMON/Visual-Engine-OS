import { writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { rasterPng } from './lib/raster';
import { patternById } from '../src/relief';

/**
 * Têtes complètes en 3D à 30° (même lumière que `artefacts-nose-plate06-heads.ts`) : plat-trapèze graines 77, 11, 1203 et pyramide graine 77.
 * Usage : `npx tsx scripts/artefacts-nose-alar-seat.ts <sortie.png>` — lancé une fois sur l'ancien code (avant) et une fois sur le nouveau (après) ;
 * `artefacts-nose-alar-seat-compose.ts` assemble les deux avec les débordements mesurés. Un nez est rendu en tête complète (cheveux, cou, épaules du corps non rendus ici : tête 3D seule).
 */
const q = patternById('three-quarter-right');
const lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const cases = [[77, 'plat-trapeze'], [11, 'plat-trapeze'], [1203, 'plat-trapeze'], [77, 'pyramide']] as const;
const img = (seed: number, a: string): string => {
  const F: any = generateRandomFace(seed, { id: 'f0', noseArchetype: a, transform: { x: 255, y: 350, scale: 0.2 } } as never);
  const r = compileScene({ width: 300, height: 380, background: '#ece6dc', objects: [...F.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 3, yaw: 30, pitch: 0, transform: { x: 150, y: 70, scale: 0.95 }, lit }] } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  return rasterPng(r.svg).toString('base64');
};
const parts = cases.map(([s, a], j) => `<image x="${j * 300}" y="0" width="300" height="380" href="data:image/png;base64,${img(s, a)}"/>`);
writeFileSync(process.argv[2]!, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="380"><rect width="100%" height="100%" fill="#ece6dc"/>${parts.join('')}</svg>`));
console.log('ok', process.argv[2]);
