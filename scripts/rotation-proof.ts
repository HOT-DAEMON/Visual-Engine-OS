import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, type SceneInput } from '../src';
import { faceLandmarks, halfWidthAt, outlinePath } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { posedFace, posedOutline, poseHairMasses } from '../src/face/pose';
import { polyPath } from '../src/render/face/path';
import { FaceParams } from '../src/schema';
import { hairFace, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves des étapes 2 et 4 (masses) de la rotation : `docs/ROTATION-HAIR-MASS.md`. `npx tsx scripts/rotation-proof.ts`.
 *  01 : rendu RÉEL (moteur) de têtes entières à plusieurs lacets ; 02 : géométrie, surcouches dessinées HORS du moteur (contour frontal pointillé, silhouette posée cyan, masses de cheveux orange).
 */
const OUT = 'artefacts/rotation-silhouette-hair', CELL = 300, STYLES: [CleanStyle, number][] = [['short', 9001], ['long', 9002], ['afro', 9000], ['bob', 9001], ['buzz', 9003], ['ponytail', 9001]];
mkdirSync(OUT, { recursive: true });
const png = (svg: string, w: number): Buffer => new Resvg(svg, { fitTo: { mode: 'width', value: w }, background: '#ffffff' }).render().asPng() as Buffer;
const faceOf = (style: CleanStyle, seed: number, yaw: number, id: string) => {
  const f = hairFace(style, 1, { seed, id });
  const host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  host.face = { ...host.face, headPose: { yawDeg: yaw } };
  return { objects: f.objects, host };
};

// 01 — rendu réel : lignes = coiffures, colonnes = lacet.
const YAWS = [-45, -30, 0, 30, 45];
{
  const objects: unknown[] = [];
  STYLES.forEach(([style, seed], r) => YAWS.forEach((yaw, c) => {
    const f = hairFace(style, 1, { seed, id: `f${r}-${c}`, transform: { x: CELL * (c + 0.5), y: CELL * (r + 0.5) + 6, scale: 0.62 } });
    (f.objects[0] as unknown as { face: Record<string, unknown> }).face = { ...(f.objects[0] as unknown as { face: Record<string, unknown> }).face, headPose: { yawDeg: yaw } };
    objects.push(...f.objects);
  }));
  const r = compileScene({ width: CELL * YAWS.length, height: CELL * STYLES.length, background: '#ffffff', objects } as unknown as SceneInput);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  writeFileSync(`${OUT}/01-rendu-lacet-x-coiffures.png`, png(r.svg, 1500));
}

// 02 — géométrie : contour frontal (pointillé), silhouette posée (cyan), masse de cuir chevelu (orange) ; mesures.
const metrics: Record<string, unknown>[] = [];
{
  const G = [-40, 0, 40], cells: string[] = [];
  STYLES.forEach(([style, seed], r) => G.forEach((yaw, c) => {
    const { host } = faceOf(style, seed, yaw, 'g');
    const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), geo0 = hairGeometry(params, lm)!, P = posedFace(lm, yaw), geo = poseHairMasses(geo0, P.skull, yaw, lm.W);
    const sil = posedOutline(lm, P), s = CELL / (lm.H * 1.18);
    const masses = [...geo.tierMasses.map((m) => m.poly), ...(geo.backBase ? [geo.backBase] : []), ...(geo.simMass ? [geo.simMass] : []), ...geo.base];
    cells.push(`<g transform="translate(${CELL * (c + 0.5)} ${CELL * (r + 0.5) + 14}) scale(${s})">
      <path d="${outlinePath(lm.outline)}" fill="none" stroke="#999" stroke-width="${1.2 / s}" stroke-dasharray="${5 / s} ${4 / s}"/>
      ${masses.map((m) => `<path d="${polyPath(m)}" fill="#ff8a1e" fill-opacity="0.28" stroke="#e06a00" stroke-width="${1.1 / s}"/>`).join('')}
      <path d="${outlinePath(sil)}" fill="none" stroke="#0aa" stroke-width="${1.6 / s}"/></g>
      <text x="${CELL * c + 8}" y="${CELL * r + 16}" font-size="13" font-family="monospace" fill="#333">${style} ${seed} · ${yaw}°</text>`);
    const w = (y: number): number => halfWidthAt(sil, y), w0 = (y: number): number => halfWidthAt(lm.outline, y);
    metrics.push({ style, seed, yaw, silhouetteRatioEye: +(w(lm.eyeY) / w0(lm.eyeY)).toFixed(4), silhouetteRatioJaw: +(w(lm.jawY) / w0(lm.jawY)).toFixed(4), baseVertices: geo.base[0]!.length, baseVerticesFrontal: geo0.base[0]!.length });
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL * G.length}" height="${CELL * STYLES.length}"><rect width="100%" height="100%" fill="#fff"/>${cells.join('')}</svg>`;
  writeFileSync(`${OUT}/02-geometrie-masses-silhouette.png`, png(svg, 900));
}
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(`artefacts écrits dans ${OUT}/`);
