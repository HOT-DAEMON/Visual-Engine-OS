import { mkdirSync, writeFileSync } from 'node:fs';
import { board } from '../lib/board';
import { rasterPng } from '../lib/raster';
import { faceLandmarks } from '../../src/face';
import { earViewSvg } from '../../src/render/face/ear/sheet';
import type { ViewName } from '../../src/face/ear/project';
import { FaceParams } from '../../src/schema';

/** Outils de planches pour les preuves visuelles de l'oreille : une cellule = une oreille rendue (modèle réel, jamais retouchée) dans une vue donnée. */
export type Edit = Record<string, unknown>;
export const SKIN = '#b98a62';
/** Fusion profonde (les éditions sont des sous-arbres de `face.ears`). */
export function merge(a: Edit, b: Edit): Edit {
  const o: Edit = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? merge(o[k] as Edit, v as Edit) : v;
  return o;
}
export const earParams = (edit: Edit, seed = 11): FaceParams => FaceParams.parse({ anatomyEngine: 'structured', ears: merge({ engine: 'morphology', seed }, edit) });
export function earCell(edit: Edit, view: ViewName, w: number, h: number, o: { seed?: number; skin?: string; zoom?: number } = {}): Buffer {
  const p = earParams(edit, o.seed ?? 11);
  return rasterPng(earViewSvg(p, faceLandmarks(p, 300, 400), { view, width: w, height: h, skin: o.skin ?? SKIN, ...(o.zoom ? { zoom: o.zoom } : {}) }), { fitWidth: w });
}
export function saveBoard(dir: string, name: string, title: string, cells: { png: Buffer; label: string }[], cols: number, w: number, h: number): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.png`, board(title, cells, cols, w, h));
  console.log(`${dir}/${name}.png`);
}
