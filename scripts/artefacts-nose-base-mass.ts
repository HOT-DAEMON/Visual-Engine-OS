import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { faceLandmarks, noseGeometry, noseArchetype } from '../src/face';
import { FaceParams } from '../src/schema';
import { lightModelOf, litUnderview, patternById, underviewRelief } from '../src/relief';
import { silhouetteOf } from '../src/verify/nose-lit';
import { underviewReliefV1 } from '../tests/helpers-nose-underview-v1';
import { rasterPng } from './lib/raster';
/**
 * Artefacts de la masse de base du nez (docs/NOSE-BASE-MASS.md) : npx tsx scripts/artefacts-nose-base-mass.ts [dossier]
 *  01 réf. 04 · AVANT (artefact v1 conservé) · APRÈS ; 02 métriques de silhouette v1 contre actuel ; 03 têtes complètes (graines 11 et 77) avec le dessous éclairé du MÊME visage.
 */
const out = process.argv[2] ?? 'artefacts/nez-base-mass';
mkdirSync(out, { recursive: true });
const b64 = (f: string, mime: string): string => `data:${mime};base64,${readFileSync(f).toString('base64')}`;
const LIGHT = { azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, model = lightModelOf(LIGHT, { style: 'soft' });
const T = (x: number, y: number, s: string, fs = 13, fill = '#fff'): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fs}" fill="${fill}">${s}</text>`;
const svgPng = (w: number, h: number, body: string): Buffer => rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#2c3040"/>${body}</svg>`, { fonts: true });

// 01 · réf. 04 / avant / après
{
  const cells: string[] = []; let k = 0;
  for (const [lab, patch] of [['nez par défaut', {}], ['archétype « pyramide »', noseArchetype('pyramide' as never)], ['archétype « cloche-ailes »', noseArchetype('cloche-ailes' as never)]] as const) {
    const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }), nose = noseGeometry(p, faceLandmarks(p, 300, 380));
    [20, 40, 60].forEach((pitch, j) => {
      const lit = litUnderview(nose, { pitchDeg: pitch }, '#c68e63', model, { shadow: p.skin.light.shadow }), sc = Math.min(230 / lit.grid.w, 190 / lit.grid.h);
      cells.push(`<image x="${560 + j * 240}" y="${40 + k * 235}" width="${lit.grid.w * sc}" height="${lit.grid.h * sc}" href="data:image/png;base64,${lit.png.toString('base64')}"/>${T(560 + j * 240, 40 + k * 235 + 205, `${lab} · ${pitch}°`, 11)}`);
    }); k++;
  }
  const body = `${T(10, 24, 'RÉFÉRENCE 04 (dessin)', 14)}<image x="10" y="40" width="380" height="515" href="${b64('references/nez/04.jpg', 'image/jpeg')}"/>
${T(560, 24, 'APRÈS : une seule masse (base-mass.ts), 3 nez × 3 tangages', 14)}
${T(10, 580, 'AVANT (artefact v1) : plaques + tige', 14)}<image x="10" y="595" width="540" height="540" href="${b64('artefacts/nez-underview/04-dessous-eclaire.png', 'image/png')}"/>${cells.join('')}`;
  writeFileSync(`${out}/01-ref04-avant-apres.png`, svgPng(1290, 1150, body));
}

// 02 · métriques de silhouette (valeurs réelles, mêmes que les règles de src/verify/nose-lit.ts)
{
  const rows: string[] = []; let y = 60;
  rows.push(T(10, 24, 'Silhouette du nez éclairé : v1 (plaques + tige) contre actuel · solidité (aire / enveloppe convexe) et col (plus étroit / plus large)', 13));
  rows.push(T(10, 44, 'bornes de src/verify/nose-lit.ts : solidité ≥ 0,75 · col ≥ 0,45 (appliquées dès 40°)', 12, '#9fd'));
  for (const [lab, patch] of [['défaut', {}], ['pyramide', noseArchetype('pyramide' as never)], ['cloche-ailes', noseArchetype('cloche-ailes' as never)]] as const) {
    const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }), nose = noseGeometry(p, faceLandmarks(p, 300, 380));
    for (const pitch of [40, 60]) {
      const n = silhouetteOf(underviewRelief(nose, { pitchDeg: pitch }, 2)), o = silhouetteOf(underviewReliefV1(nose, { pitchDeg: pitch }, 2));
      const bar = (v: number, x0: number, c: string): string => `<rect x="${x0}" y="${y - 12}" width="${Math.round(v * 200)}" height="14" fill="${c}"/>${T(x0 + Math.round(v * 200) + 6, y, v.toFixed(2), 12)}`;
      rows.push(T(10, y, `${lab} ${pitch}°`, 12), T(130, y, 'col', 11, '#aaa'), bar(o.neck, 165, '#c55'), bar(n.neck, 165 + 300, '#5b8'), T(130, y + 20, 'solidité', 11, '#aaa'), bar(o.solidity, 165, '#c55').replace(new RegExp(`y="${y - 12}"`, 'g'), `y="${y + 8}"`), bar(n.solidity, 465, '#5b8').replace(new RegExp(`y="${y - 12}"`, 'g'), `y="${y + 8}"`));
      y += 52;
    }
  }
  rows.push(T(165, y + 10, 'rouge = v1 · vert = actuel', 12, '#ddd'));
  writeFileSync(`${out}/02-metriques-silhouette.png`, svgPng(900, y + 30, rows.join('')));
}

// 03 · têtes complètes + dessous éclairé du même visage
{
  const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
  const parts: string[] = []; let k = 0;
  for (const seed of [11, 77]) {
    const F = generateRandomFace(seed, { id: 'f0', transform: { x: 340, y: 320, scale: 0.3 } } as never), skin = (F.objects[0] as unknown as { material: { color: string } }).material.color;
    [[0, 0], [45, 0], [0, 25]].forEach(([yaw, pitch], j) => {
      const r = compileScene({ width: 300, height: 360, background: '#ece6dc', objects: [...generateRandomFace(seed, { id: 'f0', transform: { x: 290, y: 350, scale: 0.05 } } as never).objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 2, yaw, pitch, transform: { x: 150, y: 30, scale: 0.62 }, lit }] } as never);
      if (!r.ok) throw new Error(r.issues.join(';'));
      parts.push(`<image x="${j * 300}" y="${k * 380}" width="300" height="360" href="data:image/png;base64,${rasterPng(r.svg).toString('base64')}"/>${T(j * 300 + 6, k * 380 + 372, `graine ${seed} · lacet ${yaw}° tangage ${pitch}°`, 11)}`);
    });
    const p = F.params, nose = noseGeometry(p, faceLandmarks(p, F.width, F.height)), l = litUnderview(nose, { pitchDeg: 40 }, skin, model, { shadow: p.skin.light.shadow }), sc = Math.min(300 / l.grid.w, 360 / l.grid.h);
    parts.push(`<image x="900" y="${k * 380}" width="${l.grid.w * sc}" height="${l.grid.h * sc}" href="data:image/png;base64,${l.png.toString('base64')}"/>${T(906, k * 380 + 372, `graine ${seed} · dessous éclairé 40° (peau de l'hôte)`, 11)}`);
    k++;
  }
  writeFileSync(`${out}/03-tetes-et-dessous.png`, svgPng(1210, 770, parts.join('')));
}
console.log('artefacts écrits dans', out);
