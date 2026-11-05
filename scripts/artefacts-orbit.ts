import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { openingInHost, orbitRatio, publishedOrbits, sideOf } from '../src/anatomy/orbit';
import { hostFace } from '../src/render/face';
import type { HostSpec } from '../src/schema';
import { rasterPng } from './lib/raster';

/** Planches de preuve de l'orbite publiée : AVANT (HEAD) | APRÈS | superposition (a priori pointillé, publiée pleine, ouverture verte). Prérequis : `orbit-dump` sur les deux arbres. */
const OUT = 'artefacts/orbit-publish';
mkdirSync(OUT, { recursive: true });
const seeds = readFileSync('/tmp/orbit-seeds.txt', 'utf8').trim().split(',').map(Number);
const inner = (svg: string): string => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
const W = 380, H = 470, HEAD = 56, ROW = H + 38;
const txt = (x: number, y: number, s: string, size = 13, fill = '#e8ecf6', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const ell = (cx: number, cy: number, rx: number, ry: number, extra: string): string => `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="none" ${extra}/>`;

function row(seed: number, y0: number): string {
  const probe = generateRandomFace(seed, { id: 'p', transform: { x: 0, y: 0, scale: 1 } }).height, s = 400 / probe;
  const scene = SceneSpec.parse({ width: W, height: H, objects: generateRandomFace(seed, { id: 'f0', transform: { x: 190, y: 235, scale: s } }).objects });
  const host = scene.objects.find((o) => o.kind === 'host') as HostSpec;
  const lm = hostFace(host).lm, eyes = placedEyesByHost(scene).get('f0') ?? [], pub = publishedOrbits(lm, eyes);
  const T = host.transform, wp = (p: { x: number; y: number }) => ({ x: T.x + T.scale * p.x, y: T.y + T.scale * p.y });
  let over = '';
  const notes: string[] = [];
  for (const side of ['left', 'right'] as const) {
    const pr = lm.orbit[side], pb = pub[side], c0 = wp({ x: pr.cx, y: pr.cy }), c1 = wp({ x: pb.cx, y: pb.cy });
    over += ell(c0.x, c0.y, pr.rx * T.scale, pr.ry * T.scale, 'stroke="#ff6b6b" stroke-width="1.6" stroke-dasharray="5 4"');
    over += ell(c1.x, c1.y, pb.rx * T.scale, pb.ry * T.scale, 'stroke="#27d3e6" stroke-width="1.8"');
    for (const pe of eyes.filter((e) => sideOf(e) === side)) {
      const pts = openingInHost(pe);
      over += `<path d="${pts.map((q, i) => `${i ? 'L' : 'M'}${wp(q).x.toFixed(2)} ${wp(q).y.toFixed(2)}`).join('')}Z" fill="#8cff9e" fill-opacity="0.35" stroke="#8cff9e" stroke-width="1.2"/>`;
      notes.push(`${side === 'left' ? 'G' : 'D'} : ${orbitRatio(pr, pts).toFixed(2)} → ${orbitRatio(pb, pts).toFixed(2)}${pb.grown ? ` (aire ×${pb.growth.toFixed(2)})` : ' (inchangée)'}`);
    }
  }
  const cell = (file: string, x: number, extra: string) => `<g transform="translate(${x} ${y0})"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner(readFileSync(file, 'utf8'))}${extra}</svg></g>`;
  return cell(`/tmp/orbit-before/${seed}.svg`, 0, '') + cell(`/tmp/orbit-after/${seed}.svg`, W, '') + cell(`/tmp/orbit-after/${seed}.svg`, 2 * W, over) +
    txt(8, y0 + H + 20, `graine ${seed}`, 14, '#ffd479') + txt(2 * W + 8, y0 + H + 16, 'rapport œil/orbite (≤ 1 : dedans), a priori → publiée', 10.5, '#8d97b5') + txt(2 * W + 8, y0 + H + 30, notes.join('  ·  '), 10.5, '#cfd6ea');
}

function plate(name: string, list: number[], title: string): void {
  const h = HEAD + list.length * ROW, w = 3 * W;
  const head = txt(12, 22, title, 16, '#ffffff') + txt(12, 44, 'AVANT (HEAD, orbite a priori)  |  APRÈS (orbite publiée par l\'œil)  |  superposition : pointillé rouge = a priori · cyan = publiée · vert = ouverture de l\'œil', 12, '#aab3cc');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#2b3042"/>${head}${list.map((s, i) => row(s, HEAD + i * ROW)).join('')}</svg>`;
  if (/NaN|undefined|Infinity/.test(svg)) throw new Error(`${name} : valeur non finie`);
  writeFileSync(`${OUT}/${name}.png`, rasterPng(svg, { fonts: true, fitWidth: w }));
}
plate('01-avant-apres-orbite-a', seeds.slice(0, 4), "Orbite publiée par l'œil — graines 1 à 35 (visages dont l'œil sortait de l'orbite)");
plate('02-avant-apres-orbite-b', seeds.slice(4, 8), "Orbite publiée par l'œil — autres visages concernés");
console.log('planches écrites dans', OUT);
