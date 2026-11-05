import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { faceRelations } from '../src/anatomy/face-relations';
import { publishedOrbits } from '../src/anatomy/orbit';
import { placedEyesByHost } from '../src/anatomy/placed';
import { earGeometry, halfWidthAt, noseGeometry } from '../src/face';
import { hostFace } from '../src/render/face';
import type { HostSpec } from '../src/schema';
import { rasterPng } from './lib/raster';

/** Planche de preuve des relations explicites : repères et mesures dessinés SUR le rendu, puis le bilan par composant (✔ dans la limite · ⚠ avertissement · ✘ erreur). */
const OUT = 'artefacts/face-relations';
mkdirSync(OUT, { recursive: true });
const inner = (svg: string): string => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
const t = (x: number, y: number, s: string, size = 11, fill = '#e8ecf6', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const CW = 460, FH = 500, PH = 250;
const seeds = [11, 15, 42, 7];

const cells = seeds.map((seed, i) => {
  const probe = generateRandomFace(seed, { id: 'p', transform: { x: 0, y: 0, scale: 1 } }).height, s = 420 / probe, cx = CW / 2, cy = 255;
  const objs = generateRandomFace(seed, { id: 'f0', transform: { x: cx, y: cy, scale: s } }).objects;
  const input = { width: CW, height: FH, background: '#ece6dc', objects: objs };
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const sc = SceneSpec.parse(input), host = sc.objects.find((o) => o.kind === 'host') as HostSpec;
  const { params, lm } = hostFace(host), nose = noseGeometry(params, lm), pub = publishedOrbits(lm, placedEyesByHost(sc).get('f0') ?? []);
  const rels = faceRelations(params, lm, nose, pub);
  const X = (x: number): number => cx + s * x, Y = (y: number): number => cy + s * y, hwAt = (y: number): number => halfWidthAt(lm.outline, y);
  const line = (y: number, color: string, label: string, dash = '') => `<line x1="${X(-hwAt(y)) - 26}" x2="${X(hwAt(y)) + 26}" y1="${Y(y)}" y2="${Y(y)}" stroke="${color}" stroke-width="1.1" ${dash ? `stroke-dasharray="${dash}"` : ''}/>` + t(X(hwAt(y)) + 28, Y(y) + 3.5, label, 9.5, color);
  let g = '';
  g += line(lm.hair.centerY, '#ffd479', 'naissance cheveux') + line(lm.browLimitY, '#ffb36b', 'arcade') + line(lm.eyeY, '#8cff9e', 'yeux') + line(lm.noseBaseY, '#7fd6ff', 'base nez') + line(lm.mouthY, '#ff8fb8', 'bouche') + line(lm.chinY, '#c9a6ff', 'menton');
  // écart intercanthal vs largeur des ailes
  g += `<path d="M${X(lm.innerCanthus.left.x)} ${Y(lm.eyeY) + 14} h${s * (lm.innerCanthus.right.x - lm.innerCanthus.left.x)}" stroke="#8cff9e" stroke-width="2.2"/>` + t(X(0), Y(lm.eyeY) + 27, 'écart intercanthal', 9, '#8cff9e', 'middle');
  g += `<path d="M${X(-nose.widthPx / 2)} ${Y(nose.baseY) + 14} h${s * nose.widthPx}" stroke="#7fd6ff" stroke-width="2.2"/>` + t(X(0), Y(nose.baseY) + 27, 'ailes', 9, '#7fd6ff', 'middle');
  g += `<path d="M${X(-lm.lips.half)} ${Y(lm.lips.bottomY) + 14} h${2 * s * lm.lips.half}" stroke="#ff8fb8" stroke-width="2.2"/>` + t(X(0), Y(lm.lips.bottomY) + 27, 'bouche', 9, '#ff8fb8', 'middle');
  for (const sd of [-1, 1]) g += `<circle cx="${X(sd * Math.abs(lm.jaw.gonion.x))}" cy="${Y(lm.jaw.gonion.y)}" r="4.5" fill="none" stroke="#ff6b6b" stroke-width="2"/>`;
  for (const e of earGeometry(params, lm)) { const ys = e.poly.map((q) => q.y); g += `<line x1="${X(e.c.x) - 9}" x2="${X(e.c.x) + 9}" y1="${Y(Math.min(...ys))}" y2="${Y(Math.min(...ys))}" stroke="#ffb36b" stroke-width="2"/><line x1="${X(e.c.x) - 9}" x2="${X(e.c.x) + 9}" y1="${Y(Math.max(...ys))}" y2="${Y(Math.max(...ys))}" stroke="#7fd6ff" stroke-width="2"/>`; }
  for (const sd of ['left', 'right'] as const) { const o = pub[sd]; g += `<ellipse cx="${X(o.cx)}" cy="${Y(o.cy)}" rx="${s * o.rx}" ry="${s * o.ry}" fill="none" stroke="#27d3e6" stroke-width="1.2" stroke-dasharray="3 3"/>`; }
  // bilan par composant
  const bad = (q: (typeof rels)[number]): boolean => !Number.isFinite(q.value) || (q.cmp === '<=' ? q.value > q.limit : q.value < q.limit);
  const comps: [string, string][] = [['nose', 'nez'], ['mouth', 'bouche'], ['ear', 'oreille'], ['mandible', 'mâchoire'], ['hair', 'cheveux']];
  const lines = comps.map(([c, name], k) => {
    const mine = rels.filter((q) => q.between.includes(c)), errs = mine.filter((q) => bad(q) && q.severity === 'error').length, warns = mine.filter((q) => bad(q) && q.severity === 'warn');
    const mark = errs ? '✘' : warns.length ? '⚠' : '✔', col = errs ? '#ff9a9a' : warns.length ? '#ffd479' : '#9fe3b0';
    const kinds = ['geometric', 'anatomical', 'visual'].map((kd) => `${kd === 'geometric' ? 'géo' : kd === 'anatomical' ? 'ana' : 'vis'} ${mine.filter((q) => q.kind === kd && !bad(q)).length}/${mine.filter((q) => q.kind === kd).length}`).join(' · ');
    return t(10, 22 + k * 18, `${mark} ${name.padEnd(9)} ${kinds}${warns.length ? '  ⚠ ' + warns.map((q) => q.id.replace(/\.(left|right)$/, '')).filter((v, j, a) => a.indexOf(v) === j).join(', ') : ''}`, 10.5, col);
  });
  const note = t(10, 22 + 5 * 18 + 6, `canon : ailes/intercanthal ${(nose.widthPx / (lm.innerCanthus.right.x - lm.innerCanthus.left.x)).toFixed(2)} (≈1) · bouche = ${(((lm.mouthY - lm.noseBaseY) / (lm.chinY - lm.noseBaseY))).toFixed(2)} du nez→menton (≈0,33)`, 9.5, '#aab3cc');
  return `<g transform="translate(${i * CW} 40)"><svg width="${CW}" height="${FH}" viewBox="0 0 ${CW} ${FH}">${inner(r.svg)}${g}</svg>${t(8, 16, `graine ${seed}`, 12, '#ffd479')}<g transform="translate(0 ${FH})">${lines.join('')}${note}</g></g>`;
});
const W = CW * seeds.length, H = 40 + FH + PH - 90;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#2b3042"/>${t(12, 24, 'Relations explicites du visage mesurées sur le rendu — cercles rouges : angle de la mâchoire · traits oranges/bleus : haut/bas de l’oreille · pointillé cyan : orbites publiées', 13, '#ffffff')}${cells.join('')}</svg>`;
if (/NaN|undefined|Infinity/.test(svg)) throw new Error('valeur non finie');
writeFileSync(`${OUT}/01-relations-mesurees.png`, rasterPng(svg, { fonts: true, fitWidth: W }));
console.log('ok', OUT);
