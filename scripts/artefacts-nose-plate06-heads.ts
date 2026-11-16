import { writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { rasterPng } from './lib/raster';
import { patternById } from '../src/relief';

/** Têtes complètes avec les 3 archétypes reproductibles (option `noseArchetype`) : de face, puis tête 3D éclairée à 30° (même visage, même lumière). artefacts/nez-planche06-v3/02-tetes-archetypes.png */
const T = (x: number, y: number, s: string): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="12" fill="#222">${s}</text>`;
const q = patternById('three-quarter-right');
const lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const cols = [['libre (nez tel que généré)', undefined], ['pyramide', 'pyramide'], ['cloche-ailes', 'cloche-ailes'], ['plat-trapèze', 'plat-trapeze']] as const;
const img = (seed: number, a: string | undefined, three: boolean): string => {
  const F: any = generateRandomFace(seed, { id: 'f0', noseArchetype: a, transform: { x: three ? 255 : 150, y: three ? 350 : 215, scale: three ? 0.2 : 0.72 } } as never);
  const objs = three ? [...F.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 3, yaw: 30, pitch: 0, transform: { x: 150, y: 70, scale: 0.95 }, lit }] : F.objects;
  const r = compileScene({ width: 300, height: 380, background: '#ece6dc', objects: objs } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  return rasterPng(r.svg).toString('base64');
};
const parts: string[] = [];
[[11, false], [11, true], [77, false]].forEach(([seed, three], k) => cols.forEach(([lab, a], j) => parts.push(`<image x="${j * 300}" y="${30 + k * 400}" width="300" height="380" href="data:image/png;base64,${img(seed as number, a, three as boolean)}"/>${T(j * 300 + 6, 22 + k * 400, `graine ${seed} ${three ? '3D yaw 30' : 'face'} · ${lab}`)}`)));
writeFileSync('artefacts/nez-planche06-v3/02-tetes-archetypes.png', rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1230"><rect width="100%" height="100%" fill="#ece6dc"/>${parts.join('')}</svg>`));
console.log('ok');
