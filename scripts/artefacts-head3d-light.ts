/**
 * Artefacts « tête en rotation éclairée par le moteur unique `src/relief` » : mêmes têtes, mêmes angles, planche de référence | lumière gauche | lumière droite | cel 3 tons.
 * Usage : npx tsx scripts/artefacts-head3d-light.ts [graine]  → artefacts/head3d-lit/01-rotation-eclairage.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { rasterPng } from './lib/raster';
import { patternById } from '../src/relief';

const OUT = 'artefacts/head3d-lit'; mkdirSync(OUT, { recursive: true });
const seed = Number(process.argv[2] ?? 11), CW = 260, CH = 330, YAWS = [0, 45, 90, 135];
/** L'hôte-visage (requis par `head_3d`) est posé dans la marge de droite puis rogné : la cellule ne montre que la tête tournée. */
/** Les MÊMES motifs que la tête de face (`relief/patterns.ts`, planches de référence 01 / 06 / 09) : seule la tête change. */
const pat = (id: string): Record<string, unknown> => { const q = patternById(id); return { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } }; };
const COLS: { name: string; lit: Record<string, unknown> | null }[] = [
  { name: 'planche (sans moteur)', lit: null },
  { name: patternById('side-left').label, lit: pat('side-left') },
  { name: patternById('three-quarter-right').label, lit: pat('three-quarter-right') },
  { name: patternById('underlight').label, lit: pat('underlight') },
];
const cell = (yaw: number, lit: Record<string, unknown> | null): string => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: CW + 120, y: 220, scale: 0.3 } } as never).objects;
  const r = compileScene({ width: CW + 180, height: CH, background: '#ece6dc', objects: [...f, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 2, yaw, transform: { x: CW / 2 - 8, y: 24, scale: 0.72 }, ...(lit ? { lit } : {}) }] } as never);
  if (!r.ok) throw new Error(r.issues.join(' ; '));
  return `data:image/png;base64,${rasterPng(r.svg).toString('base64')}`;
};
const parts: string[] = [];
COLS.forEach((c, j) => parts.push(`<text x="${j * CW + 6}" y="16" font-family="sans-serif" font-size="13">${c.name}</text>`));
YAWS.forEach((yaw, i) => COLS.forEach((c, j) => parts.push(`<svg x="${j * CW}" y="${20 + i * CH}" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}"><image width="${CW + 180}" height="${CH}" href="${cell(yaw, c.lit)}"/></svg><text x="${j * CW + 6}" y="${20 + i * CH + 14}" font-family="sans-serif" font-size="11" fill="#555">yaw ${yaw}°</text>`)));
writeFileSync(`${OUT}/01-rotation-eclairage.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${COLS.length * CW}" height="${20 + YAWS.length * CH}"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>`, { fonts: true }));
console.log('écrit', OUT);
