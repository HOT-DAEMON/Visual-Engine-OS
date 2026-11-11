/**
 * Artefacts de la tête 3D ÉCLAIRÉE, v2 (`artefacts/head3d-lit-v2/`) : grille lacet × tangage sous lumière fixe, gros plan du nez, mesures de la couche de vérification éclairée.
 * Usage : `npx tsx scripts/artefacts-head3d-light-v2.ts <dossier> [graine …]` ; `NOSE_ONLY=1` ne rend que le gros plan (pour l'« avant » depuis un autre commit).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { head3dSubject, hostEyesOf } from '../src/render/head-3d';
import { rasterPng } from './lib/raster';
import { lightModelOf, patternById } from '../src/relief';
import type { HostSpec } from '../src/schema';

const out = process.argv[2] ?? 'artefacts/head3d-lit-v2', seeds = process.argv.slice(3).map(Number), SEEDS = seeds.length ? seeds : [11, 77];
mkdirSync(out, { recursive: true });
const q = patternById('three-quarter-right');
const lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const png = (seed: number, W: number, H: number, hx: number, hy: number, sc: number, res: number, yaw: number, pitch: number): Buffer => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: W - 90, y: H - 80, scale: 0.3 } } as never).objects;
  const r = compileScene({ width: W, height: H, background: '#ece6dc', objects: [...f, { kind: 'head_3d', id: 't0', host: 'f0', resolution: res, yaw, pitch, transform: { x: hx, y: hy, scale: sc }, lit }] } as never);
  if (!r.ok) throw new Error(r.issues.join(' ; '));
  return rasterPng(r.svg);
};
writeFileSync(`${out}/nez-gros-plan.png`, png(11, 800, 500, 200, 10, 1.1, 3, 0, 0));
if (!process.env.NOSE_ONLY) {
  const YAWS = [0, 45, 90, 135], PITCH = [-30, 0, 30], CW = 240, CH = 300;
  for (const seed of SEEDS) {
    const parts: string[] = [];
    PITCH.forEach((p, i) => YAWS.forEach((y, j) => parts.push(`<svg x="${j * CW}" y="${i * CH}" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}"><image width="${CW + 180}" height="${CH}" href="data:image/png;base64,${png(seed, CW + 180, CH, CW / 2 - 8, 24, 0.66, 2, y, p).toString('base64')}"/></svg><text x="${j * CW + 6}" y="${i * CH + 14}" font-family="sans-serif" font-size="11" fill="#555">yaw ${y}° tangage ${p}°</text>`)));
    writeFileSync(`${out}/grille-lacet-tangage-graine-${seed}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${YAWS.length * CW}" height="${PITCH.length * CH}"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>`, { fonts: true }));
  }
  const { litChecks } = await import('../src/head-turntable/verify-light');
  const model = lightModelOf(lit.light, { style: lit.style, shadowHue: lit.shadowHue, bias: lit.bias }), rows: string[] = ['# Couche de vérification éclairée — mesures (lumière trois-quarts droite, cel)', ''];
  for (const seed of SEEDS) {
    const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never), sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
    const host = sc.objects.find((o) => o.kind === 'host') as HostSpec, spec = head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? [])).spec;
    rows.push(`## graine ${seed}`, '', '| couche | contrôle | valeur | bornes | résultat |', '|---|---|---|---|---|');
    for (const c of litChecks(spec, model)) rows.push(`| ${c.layer} | ${c.id}${c.kind === 'info' ? ' (info)' : ''} | ${Number(c.value).toFixed(3)} | ${c.min} ; ${c.max} | ${c.ok ? 'ok' : 'ÉCHEC'}`.replace(/\| (ok|ÉCHEC)$/, '| $1 |'));
    rows.push('');
  }
  writeFileSync(`${out}/mesures-verification-eclairee.md`, rows.join('\n'));
}
console.log('ok', out);
