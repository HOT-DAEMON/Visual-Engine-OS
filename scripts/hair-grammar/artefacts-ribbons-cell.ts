import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import type { RibbonProfile } from '../../src/hair-grammar/ribbon';
import { ribbonScene } from '../../src/hair-grammar/ribbon-scene';
import { compareToReference, type Gray } from '../../src/hair-grammar/verify';
import { verifyRibbonAnatomy, verifyRibbonGeometry, verifyRibbonStyle } from '../../src/hair-grammar/ribbon-verify';
import { verifyIso } from '../../src/hair-grammar/iso-verify';
import { decodePng } from '../../src/regression/png';
import { encodeRgbaPng } from './png-rgba';

/** Rendu de la cellule 01 par rubans + comparaison à la référence. Usage : `npx tsx scripts/hair-grammar/artefacts-ribbons-01.ts [dossier]`. */
const [CFGP, PROF, REFP, DIR] = process.argv.slice(2) as [string, string, string, string];
const CFG = JSON.parse(readFileSync(CFGP, 'utf8')) as { id: string; crop: number[] };
const VW = (CFG.crop[2] as number) - (CFG.crop[0] as number); const VH = (CFG.crop[3] as number) - (CFG.crop[1] as number);
mkdirSync(DIR, { recursive: true });
const P = JSON.parse(readFileSync(PROF, 'utf8')) as RibbonProfile;
const raster = (svg: string, px: number): { png: Uint8Array; g: Gray } => {
  const img = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: px } }).render();
  const d = new Uint8Array(img.width * img.height); const rgba = img.pixels;
  for (let i = 0; i < d.length; i++) d[i] = Math.round(0.299 * (rgba[i * 4] as number) + 0.587 * (rgba[i * 4 + 1] as number) + 0.114 * (rgba[i * 4 + 2] as number));
  return { png: img.asPng(), g: { w: img.width, h: img.height, data: d } };
};
const LAYERS = (process.env.LAYERS ?? 'auto') as 'auto' | 'bands' | 'ribbons';
const svg = ribbonScene(P, { w: VW, h: VH, px: 4 }, undefined, undefined, LAYERS);
const mine = raster(svg, VW * 4);
writeFileSync(`${DIR}/${CFG.id}-rubans.png`, mine.png); writeFileSync(`${DIR}/${CFG.id}-rubans.svg`, svg);
const rr = decodePng(readFileSync(REFP));
const ref: Gray = { w: rr.width, h: rr.height, data: Uint8Array.from({ length: rr.width * rr.height }, (_, i) => rr.data[i * 4] as number) };
const m = compareToReference(ref, mine.g, 8, VH * 4);
const W = ref.w; const H = ref.h; const b64 = (p: string | Uint8Array): string => Buffer.from(typeof p === 'string' ? readFileSync(p) : p).toString('base64');
writeFileSync(`${DIR}/02-reference-vs-rubans.png`, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><image href="data:image/png;base64,${b64(REFP)}" width="${W}" height="${H}"/><image href="data:image/png;base64,${b64(mine.png)}" x="${W}" width="${W}" height="${H}"/></svg>`).render().asPng());
const over = new Uint8Array(W * H * 4);
// noir = encre commune ; rouge = encre de la référence MANQUANTE dans le moteur ; cyan = encre du moteur EN TROP ; blanc = fond commun
for (let i = 0; i < W * H; i++) { const a = (ref.data[i] as number) < 140; const b = (mine.g.data[i] as number) < 140; const [r, g, bl] = a && b ? [30, 30, 30] : a ? [220, 20, 20] : b ? [0, 175, 200] : [255, 255, 255]; over[i * 4] = r; over[i * 4 + 1] = g; over[i * 4 + 2] = bl; over[i * 4 + 3] = 255; }
writeFileSync(`${DIR}/03-superposition-noir-commun-rouge-manquant-cyan-en-trop.png`, encodeRgbaPng(over, W, H));
// Distance perceptuelle grossière : écart moyen absolu entre les deux images floutées (boîte 12 px sur l'image ×4), 0 = identique, 1 = noir/blanc.
const boxBlur = (g: Gray, r: number): Float32Array => { const o = new Float32Array(g.w * g.h); for (let y = 0; y < g.h; y += 1) for (let x = 0; x < g.w; x += 1) { let s = 0; let n = 0; for (let dy = -r; dy <= r; dy += 3) for (let dx = -r; dx <= r; dx += 3) { const xx = x + dx; const yy = y + dy; if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h) { s += g.data[yy * g.w + xx] as number; n++; } } o[y * g.w + x] = s / n; } return o; };
const ba = boxBlur(ref, 12); const bb = boxBlur(mine.g, 12); let acc = 0; let cnt = 0;
for (let y = 0; y < VH * 4; y++) for (let x = 0; x < W; x++) { acc += Math.abs((ba[y * W + x] as number) - (bb[y * W + x] as number)) / 255; cnt++; }
const blurDiff = acc / cnt;
// Temps : construction du SVG (médiane de 15 passes après échauffement) et rastérisation 312 px.
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const tb: number[] = []; const tr: number[] = [];
for (let i = 0; i < 17; i++) { const t0 = performance.now(); const sv = ribbonScene(P, { w: VW, h: VH, px: 2 }, undefined, undefined, LAYERS); const t1 = performance.now(); raster(sv, VW * 2); const t2 = performance.now(); if (i >= 2) { tb.push(t1 - t0); tr.push(t2 - t1); } }
const geo = verifyRibbonGeometry(P); const ana = verifyRibbonAnatomy(P); const sty = verifyRibbonStyle(P);
const iso = P.bands ? verifyIso(P, { w: VW, h: VH }) : null;
if (iso) writeFileSync(`${DIR}/verification-iso.json`, JSON.stringify({ geometry: iso.geometry, anatomy: iso.anatomy, style: iso.style, measures: iso.measures }, null, 2));
const out = { cell: CFG.id, layers: LAYERS, isoOk: iso ? iso.geometry.ok && iso.anatomy.ok && iso.style.ok : null, ribbons: P.ribbons.length, tones: P.tones.length, svgKB: Math.round(svg.length / 1024), buildMsMedian: Number(med(tb).toFixed(2)), rasterMsMedian312: Number(med(tr).toFixed(1)), reference: m, blurDiff: Number(blurDiff.toFixed(4)), verification: { geo, ana, sty } };
writeFileSync(`${DIR}/metrics.json`, JSON.stringify(out, null, 2)); writeFileSync(`${DIR}/verification.json`, JSON.stringify({ geo, ana, sty }, null, 2));
console.log(JSON.stringify({ ...out, verification: { geo: geo.ok, ana: ana.ok, sty: sty.ok } }));
for (const r of iso ? [geo, ana, sty, iso.geometry, iso.anatomy, iso.style] : [geo, ana, sty]) for (const c of r.checks) console.log(c.ok ? 'ok   ' : 'ÉCHEC', r.layer, c.name, c.value.toFixed(3));
