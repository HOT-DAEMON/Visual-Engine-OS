import { writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { rasterPng } from './lib/raster';
import { patternById } from '../src/relief';

/**
 * Têtes 3D complètes éclairées (même lumière que `artefacts-nose-alar-seat.ts`), 3 nez × 3 lacets (0°, 30°, 45°), pour la preuve avant/après de `docs/NOSE-WIDTH-3D.md`.
 * Usage : `npx tsx scripts/artefacts-nose-width3d.ts <sortie.png>` — lancé sur l'ancien code (worktree du commit précédent) puis sur le nouveau ; `scripts/artefacts-nose-width3d-compose.py` assemble.
 * Sortie : grille 900 × 1140 (une cellule = 300 × 380), lignes = plat-trapèze 77, pyramide 11, cloche-ailes 1203.
 */
const q = patternById('three-quarter-right');
const lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const rows = [[77, 'plat-trapeze'], [11, 'pyramide'], [1203, 'cloche-ailes']] as const, yaws = [0, 30, 45] as const;
const img = (seed: number, a: string, yaw: number): string => {
  const F: any = generateRandomFace(seed, { id: 'f0', noseArchetype: a, transform: { x: 255, y: 350, scale: 0.2 } } as never);
  const r = compileScene({ width: 300, height: 380, background: '#ece6dc', objects: [...F.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 3, yaw, pitch: 0, transform: { x: 150, y: 70, scale: 0.95 }, lit }] } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  return rasterPng(r.svg).toString('base64');
};
// ROW=<0..2> : ne rend qu'une ligne (900 × 380) ; un rendu éclairé de tête complète coûte ≈ 30 s, la grille entière ≈ 4,5 min.
const only = process.env.ROW === undefined ? undefined : Number(process.env.ROW), sel = rows.map((r, i) => [r, i] as const).filter(([, i]) => only === undefined || i === only);
const parts = sel.flatMap(([[s, a], i]) => yaws.map((y, j) => `<image x="${j * 300}" y="${(only === undefined ? i : 0) * 380}" width="300" height="380" href="data:image/png;base64,${img(s, a, y)}"/>`));
writeFileSync(process.argv[2]!, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${sel.length * 380}"><rect width="100%" height="100%" fill="#ece6dc"/>${parts.join('')}</svg>`));
console.log('ok', process.argv[2]);
