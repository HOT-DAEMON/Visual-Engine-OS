/**
 * Preuves visuelles du volume de cheveux 3D (docs/HAIR-VOLUME-3D.md) → artefacts/hair-volume/.
 *   01-toutes-coiffures-6-angles.png   les 10 coiffures non chauves × 0 / 60 / 120 / 180 / 240 / 300° (une graine)
 *   02-avant-apres-<style>.png          tête sans volume (avant) / avec volume (après), 8 angles
 *   03-graines-<style>.png              3 graines × 0 / 90 / 180°
 *   04-tangage-<style>.png              pitch −20 / 0 / +25 à 3 angles (la coiffure suit le crâne en 3D, pas seulement en lacet)
 * Usage : npx tsx scripts/artefacts-hair-volume.ts [dossier]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePngRgba } from '../src/core/png';
import { defaultFrame, renderHead, type HeadTurnSpec } from '../src/head-turntable';
import { subjectOf } from './hair-volume/subject';
import type { CleanStyle } from './lib/hair-faces';

const OUT = process.argv[2] ?? 'artefacts/hair-volume';
mkdirSync(OUT, { recursive: true });
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'] as CleanStyle[];
interface Tile { w: number; h: number; rgba: Uint8Array }

/** Rendu d'une vue, réduit d'un facteur `k` (moyenne de blocs) pour tenir dans une planche. */
function tile(spec: HeadTurnSpec, yaw: number, pitch: number, k: number): Tile {
  const r = renderHead({ yaw, pitch }, spec, { frame: defaultFrame(520), ss: 2 }), w = Math.floor(r.w / k), h = Math.floor(r.h / k), o = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) { let s = 0; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += r.rgba[((y * k + j) * r.w + x * k + i) * 4 + c]!; o[(y * w + x) * 4 + c] = Math.round(s / (k * k)); }
  return { w, h, rgba: o };
}

/** Planche : lignes de tuiles sur fond clair, gouttière de 6 px. */
function sheet(rows: Tile[][], file: string): void {
  const w = Math.max(...rows.map((r) => r.reduce((s, t) => s + t.w + 6, 6))), rh = rows.map((r) => Math.max(...r.map((t) => t.h)) + 6), h = rh.reduce((a, b) => a + b, 6);
  const buf = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { buf[i * 4] = 244; buf[i * 4 + 1] = 242; buf[i * 4 + 2] = 238; buf[i * 4 + 3] = 255; }
  let y0 = 6;
  rows.forEach((row, ri) => { let x0 = 6; for (const t of row) { for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { const a = t.rgba[(y * t.w + x) * 4 + 3]! / 255, d = ((y0 + y) * w + x0 + x) * 4; for (let c = 0; c < 3; c++) buf[d + c] = Math.round(t.rgba[(y * t.w + x) * 4 + c]! * a + buf[d + c]! * (1 - a)); } x0 += t.w + 6; } y0 += rh[ri]!; });
  writeFileSync(`${OUT}/${file}`, encodePngRgba(w, h, buf)); console.log(file, w, 'x', h);
}

const SEED = 9000, bare = (s: HeadTurnSpec): HeadTurnSpec => { const { hairVolume: _v, ...r } = s; return r as HeadTurnSpec; };
const spec = (st: CleanStyle, seed = SEED): HeadTurnSpec => subjectOf(st, 1, { seed }).spec;

sheet(STYLES.map((st) => { const s = spec(st); return [0, 60, 120, 180, 240, 300].map((y) => tile(s, y, 8, 2)); }), '01-toutes-coiffures-6-angles.png');
for (const st of ['afro', 'long', 'bun'] as CleanStyle[]) {
  const s = spec(st), ys = [0, 45, 90, 135, 180, 225, 270, 315];
  sheet([ys.map((y) => tile(bare(s), y, 8, 2)), ys.map((y) => tile(s, y, 8, 2))], `02-avant-apres-${st}.png`);
  sheet([4, 7, SEED].map((sd) => [0, 90, 180].map((y) => tile(spec(st, sd), y, 8, 2))), `03-graines-${st}.png`);
  sheet([-20, 0, 25].map((p) => [30, 150, 210].map((y) => tile(s, y, p, 2))), `04-tangage-${st}.png`);
}
