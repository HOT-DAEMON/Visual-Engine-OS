import type { LockSpec } from '../../src/hair-grammar/lock';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { drawFace } from '../../src/hair-grammar/face3q';
import { TOUSLED_FITTED } from '../../src/hair-grammar/profiles/tousled.fitted';
import { paintHair } from '../../src/hair-grammar/paint';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { VIEW_01 } from '../../src/hair-grammar/views';
import { compareToReference, verifyAnatomy, verifyGeometry, verifyStyle, type Gray } from '../../src/hair-grammar/verify';
import { decodePng } from '../../src/regression/png';

/** Artefacts de la cellule 01 : `artefacts/hair-grammar/` (rendu, côte à côte, superposition, métriques, perf, vérification). */
const DIR = 'artefacts/hair-grammar';
mkdirSync(DIR, { recursive: true });
const ROI = { w: 156, h: 150 };
const build = (_seed: number): { svg: string; hair: ReturnType<typeof paintHair>; specs: LockSpec[] } => {
  const face = drawFace(TOUSLED.head, VIEW_01);
  const specs = [...TOUSLED_FITTED];
  const hair = paintHair(TOUSLED.head, specs, VIEW_01);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ROI.w} ${ROI.h}" width="${ROI.w * 4}" height="${ROI.h * 4}"><rect width="100%" height="100%" fill="#fff"/>${hair.back}${face.neckBack}${face.ear}${face.skin}${face.lines}${face.eyes}${hair.front}${hair.over}</svg>`;
  return { svg, hair, specs };
};
const raster = (svg: string, px: number): { png: Uint8Array; g: Gray } => {
  const img = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: px } }).render();
  const rgba = img.pixels; const data = new Uint8Array(img.width * img.height);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(0.299 * (rgba[i * 4] as number) + 0.587 * (rgba[i * 4 + 1] as number) + 0.114 * (rgba[i * 4 + 2] as number));
  return { png: img.asPng(), g: { w: img.width, h: img.height, data } };
};
const grayOf = (path: string): Gray => { const r = decodePng(readFileSync(path)); const d = new Uint8Array(r.width * r.height); for (let i = 0; i < d.length; i++) d[i] = r.data[i * 4] as number; return { w: r.width, h: r.height, data: d }; };

// Temps : construction (géométrie + SVG) et rastérisation, médiane de 15 passes après échauffement.
const times: { build: number[]; raster: number[] } = { build: [], raster: [] };
let last = build(1);
for (let i = 0; i < 17; i++) { const t0 = performance.now(); last = build(1); const t1 = performance.now(); raster(last.svg, 312); const t2 = performance.now(); if (i >= 2) { times.build.push(t1 - t0); times.raster.push(t2 - t1); } }
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;

const mine = raster(last.svg, 624);
writeFileSync(`${DIR}/01-tousled-moteur.png`, mine.png);
writeFileSync(`${DIR}/01-tousled-moteur.svg`, last.svg);
const refPath = `${DIR}/refs/h01-roi-x4.png`;
const ref = grayOf(refPath); const m = mine.g;
const metrics = compareToReference(ref, m, 8, 132 * 4);
// Côte à côte et superposition (référence en rouge, moteur en cyan) via SVG d'images.
const b64 = (p: string | Uint8Array): string => Buffer.from(typeof p === 'string' ? readFileSync(p) : p).toString('base64');
const W = ref.w; const Hh = ref.h;
const side = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${Hh}"><rect width="100%" height="100%" fill="#fff"/><image href="data:image/png;base64,${b64(refPath)}" x="0" y="0" width="${W}" height="${Hh}"/><image href="data:image/png;base64,${b64(mine.png)}" x="${W}" y="0" width="${W}" height="${Hh}"/></svg>`;
writeFileSync(`${DIR}/02-reference-vs-moteur.png`, new Resvg(side).render().asPng());
const over = new Uint8Array(W * Hh * 4);
for (let i = 0; i < W * Hh; i++) { const a = (ref.data[i] as number) < 140; const b = (m.data[i] as number) < 140; over[i * 4] = a ? 215 : b ? 0 : 255; over[i * 4 + 1] = a && b ? 0 : b ? 170 : a ? 0 : 255; over[i * 4 + 2] = a && b ? 0 : b ? 190 : a ? 0 : 255; over[i * 4 + 3] = 255; }
const { Resvg: R2 } = await import('@resvg/resvg-js'); void R2;
const { encodeRgbaPng } = await import('./png-rgba');
writeFileSync(`${DIR}/03-superposition-rouge-ref-cyan-moteur.png`, encodeRgbaPng(over, W, Hh));

const geo = verifyGeometry(last.hair); const ana = verifyAnatomy(TOUSLED.head, VIEW_01, last.hair); const sty = verifyStyle(last.specs, 0.85);
const out = { cell: '01-tousled', locks: last.specs.length, svgKB: Math.round(last.svg.length / 1024), buildMsMedian: Number(med(times.build).toFixed(1)), rasterMsMedian312: Number(med(times.raster).toFixed(1)), reference: metrics, verification: { geo, ana, sty } };
writeFileSync(`${DIR}/metrics.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, verification: { geo: geo.ok, ana: ana.ok, sty: sty.ok } }, null, 2));
for (const r of [geo, ana, sty]) for (const c of r.checks) if (!c.ok) console.log('ÉCHEC', r.layer, c.name, c.value.toFixed(3), `[${c.min}, ${c.max}]`);
