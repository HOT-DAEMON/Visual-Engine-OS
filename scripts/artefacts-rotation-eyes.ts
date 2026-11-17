import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileScene, generateRandomFace } from '../src';
import { openingGeometry, turnOpening } from '../src/geometry/eye';
import { SceneSpec } from '../src/schema';
import { rasterPng } from './lib/raster';

/**
 * ROTATION — ÉTAPE 3 (yeux) : trois rendus SVG comparables (0°, +35°, −35°), MÊME graine (11), mêmes dimensions, mêmes paramètres, deux modèles : `sphere` (turn3d.ts) et `flat` (historique).
 * Les deux yeux sont ceux du visage hôte (`generateRandomFace(11)`), reposés côte à côte ; azimuts −22° (œil gauche de l'image) et +22° (œil droit). Aucun nouveau moteur : `compileScene` seul.
 * Sortie : `artefacts/rotation-step-03-yeux/` (PNG par angle, planche, `mesures.json`). Ne dessine ni le visage ni les cheveux (étapes 2 et 4).
 */
const OUT = join('artefacts', 'rotation-step-03-yeux'); mkdirSync(OUT, { recursive: true });
const face = generateRandomFace(11, { id: 'f0', transform: { x: 400, y: 420, scale: 1 } } as never);
const eyes = (face.objects as { kind: string; id: string; place?: unknown; transform: Record<string, number> }[]).filter((o) => o.kind === 'eye');
const W = 660, H = 170, ANGLES = [0, 35, -35] as const;
const pair = (model: 'sphere' | 'flat', yaw: number, ox: number, oy: number) => eyes.map(({ place: _place, ...e }, i) => ({ ...e, id: `${e.id}-${model}-${yaw}-${ox}`, transform: { ...e.transform, x: ox + (i === 0 ? -64 : 64), y: oy, scale: 0.34 }, headTurn: { model, yawDeg: yaw, pitchDeg: 0, azimuthDeg: i === 0 ? -22 : 22, parallax: false } }));
const svgOf = (objects: unknown[], w: number, h: number): string => { const r = compileScene(SceneSpec.parse({ width: w, height: h, background: '#ffffff', objects }) as never) as { svg: string }; return r.svg; };
const label = (svg: string, items: { x: number; y: number; t: string }[]): string => svg.replace('</svg>', `${items.map((i) => `<text x="${i.x}" y="${i.y}" font-family="sans-serif" font-size="14" fill="#222">${i.t}</text>`).join('')}</svg>`);
const files: string[] = [];
for (const yaw of ANGLES) {
  const svg = svgOf([...pair('sphere', yaw, 140, 95), ...pair('flat', yaw, 490, 95)].map((o) => o), W, H);
  const out = label(svg, [{ x: 10, y: 22, t: `lacet ${yaw > 0 ? '+' : ''}${yaw}° · sphère` }, { x: 350, y: 22, t: 'plat (historique, avec parallaxe)' }, { x: 10, y: 160, t: 'œil gauche : az −22° · œil droit : az +22°' }]);
  const name = `yeux-${yaw === 0 ? '0' : yaw > 0 ? 'p35' : 'm35'}deg`;
  writeFileSync(join(OUT, `${name}.svg`), out); writeFileSync(join(OUT, `${name}.png`), rasterPng(out, { fonts: true, fitWidth: W * 2 })); files.push(name);
}
// Mesures : largeur de l'ouverture (px moteur) et orientation vers la caméra de chaque œil (loi analytique cos(az + lacet) / cos(az)).
const e0 = SceneSpec.parse({ width: 64, height: 64, objects: [{ ...eyes[0], place: undefined }] }).objects[0] as { shape: Parameters<typeof openingGeometry>[0]; canthi: Parameters<typeof openingGeometry>[1] };
const g0 = openingGeometry(e0.shape, e0.canthi), rows = ANGLES.flatMap((yaw) => [-22, 22].map((az) => { const t = turnOpening(g0, { yawDeg: yaw, pitchDeg: 0, azimuthDeg: az, radius: e0.shape.width * 3 }, true); return { yaw, azimuth: az, largeur: +(t.g.w).toFixed(2), rapport: +(t.g.w / g0.w).toFixed(4), analytique: +(Math.cos(((az + yaw) * Math.PI) / 180) / Math.cos((az * Math.PI) / 180)).toFixed(4), facing: +t.facing.toFixed(4) }; }));
writeFileSync(join(OUT, 'mesures.json'), JSON.stringify({ graine: 11, largeurOuvertureAu0: +g0.w.toFixed(2), lignes: rows }, null, 2));
console.log(files.join(' '), rows.map((r) => `${r.yaw}/${r.azimuth}:${r.rapport}~${r.analytique}`).join(' '));
