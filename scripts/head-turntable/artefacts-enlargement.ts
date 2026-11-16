import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace, SceneSpec } from '../../src';
import { encodePngRgba } from '../../src/core/png';
import { dominantColor } from '../../src/materials';
import { skullGeometry } from '../../src/skull/geometry';
import { SkullParams } from '../../src/skull/types';
import { deriveSkull } from '../../src/skull/derive';
import { generateRandomProfile } from '../../src/generation/random-skull';
import { hostFace } from '../../src/render/face';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { headSpecFromProfile } from '../../src/head-turntable/engines/from-face';
import { hostHairline } from '../../src/head-turntable/engines/from-host';
import { HeadRenders } from '../../src/head-turntable/verify-head';
import { hostOverlap } from '../../src/head-turntable/verify-host';
import type { HostSpec } from '../../src/schema';
import { rasterPng } from '../lib/raster';
import { halfWidthAt } from '../../src/face/outline';
import { isBare, toEngineY } from '../../src/head-turntable/engines/rows';
import { py, Y0 as Y_VERTEX } from '../../src/head-turntable/engines/units';
import { vaultRise, vaultTop, warpY } from '../../src/head-turntable/engines/vault-model';
import { sectionAt } from '../../src/head-turntable/sections';
import { topRow } from '../../src/head-turntable/silhouette';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Preuves visuelles du CRÂNE NU (`docs/SKULL-ENLARGEMENT.md`). Tout vient du rendu réel (`compileScene`, `renderHead`), jamais d'un montage.
 *  01 : silhouette à 0° — dessin 2D de l'hôte (gris), ancien 3D (rouge), crâne nu (vert) : l'écart de hauteur et de largeur.
 *  02 : la tête entière de l'hôte (crâne nu + coque de cheveux), lacet 0 → 180° : le contour ne s'élargit plus en tournant.
 *  03 : le profil 2D lit les mesures de voûte (contour nominal gris, −1 bleu, +1 orange).
 * Usage : tsx artefacts-enlargement.ts [dossier] — défaut `artefacts/skull-enlargement`.
 */
const OUT = process.argv[2] ?? 'artefacts/skull-enlargement', BG = '#2b3042';
mkdirSync(OUT, { recursive: true });
const b64 = (png: Buffer | Uint8Array): string => Buffer.from(png).toString('base64');
const txt = (x: number, y: number, s: string, size = 13, fill = '#e8ecf6'): string => `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" fill="${fill}">${s}</text>`;
const sheet = (name: string, w: number, h: number, body: string): void => { writeFileSync(join(OUT, `${name}.png`), rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`, { fonts: true, fitWidth: Math.min(2400, w) })); };
const px = (svg: string): { w: number; h: number; d: Uint8Array } => { const r = new Resvg(svg, { fitTo: { mode: 'original' } }).render(); return { w: r.width, h: r.height, d: r.pixels }; };

function hostScene(seed: number, head: Record<string, unknown> | null, at = { x: 400, y: 420 }) {
  const f = generateRandomFace(seed, { id: 'f0', transform: { ...at, scale: 1 } } as never), objects = [...f.objects, ...(head ? [{ kind: 'head_3d', id: 't0', host: 'f0', resolution: 2, ...head }] : [])];
  const r = compileScene({ width: 800, height: 800, background: '#ffffff', objects } as never) as { ok: boolean; svg: string; issues: string[] };
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const sc = SceneSpec.parse({ width: 800, height: 800, objects });
  return { svg: r.svg, sc, host: sc.objects.find((o) => o.kind === 'host') as HostSpec };
}

// ---------- 01 : silhouettes à 0°, ancien vs nu ----------
/** Écarts mesurés du crâne seul (sans cheveux) au visage 2D : sommet − vertex (U, > 0 = plus haut) et demi-largeur max − contour 2D (U, > 0 = plus large), sur la voûte y ∈ [0,15 ; 0,55]. */
function skullExcess(spec: HeadTurnSpec): { top: number; width: number } {
  const e = spec.engine!, R = new HeadRenders(spec).skull.at(0, true), top = (topRow(R) - R.originY) / R.ppu, bare = isBare(e), rise = vaultRise(e), v = vaultTop(e);
  let width = -1;
  for (let y = Math.max(0.15, v - rise + 0.1); y <= 0.55; y += 0.05) width = Math.max(width, sectionAt(spec, y).a - halfWidthAt(e.lm.outline, Math.min(py(toEngineY(warpY(y, rise, v), bare)), e.lm.outline.bottomY - 1)) / 1000);
  return { top: Y_VERTEX - rise - top, width };   // > 0 : le sommet 3D est au-dessus du vertex du visage 2D
}
const CW = 400, CH = 530, X0 = 200, Y0 = 170;
let b1 = txt(20, 28, 'Silhouette à 0° : dessin 2D de l\'hôte (gris) · ancien 3D (rouge) · crâne nu (vert) — têtes chauves, mesures « ancien → nouveau »', 17);
[42, 4, 16, 36].forEach((seed, i) => {
  const { svg, sc, host } = hostScene(seed, null), { params, lm } = hostFace(host), H = lm.H, a = px(svg);
  const d = deriveSkull(params, lm.W / lm.H, { hair: 'auto' }, { ci: 0, axes: {} });
  const src = { face: { params, width: lm.W, height: lm.H }, skull: d.skull, derivation: d, skin: dominantColor(host.material.base), hair: params.hair.color ?? '#4a3222' } as never;
  const hl = hostHairline(params, lm);
  const variant = (bare: boolean) => { const s = headSpecFromProfile(src, undefined, hl, { legacyCrown: !bare }); return { s, r: renderHead({ yaw: 0, pitch: 0 }, s, { frame: defaultFrame(420), ss: 2 }) }; };
  const old = variant(false), nu = variant(true);
  const on = (v: typeof old, cx: number, cy: number): boolean => { const xu = (X0 + cx - 400) / H, yu = 0.05 + (Y0 + cy - (420 - H / 2)) / H, col = Math.round(v.r.originX + xu * v.r.ppu), row = Math.round(v.r.originY + yu * v.r.ppu); return col >= 0 && row >= 0 && col < v.r.w && row < v.r.h && v.r.ids[row * v.r.w + col] !== 0 && yu < 1.06; };
  const rgba = new Uint8ClampedArray(CW * CH * 4).fill(255), setp = (x: number, y: number, c: [number, number, number]): void => { if (x < 0 || y < 0 || x >= CW || y >= CH) return; const o = (y * CW + x) * 4; rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255; };
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const sx = X0 + x, sy = Y0 + y, o = (sy * a.w + sx) * 4; if (sy < a.h && (a.d[o]! < 245 || a.d[o + 1]! < 245 || a.d[o + 2]! < 245) && sy < 420 + 0.62 * H) setp(x, y, [205, 208, 215]); }
  const edge = (v: typeof old, c: [number, number, number]): void => { for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) if (on(v, x, y) && (!on(v, x - 1, y) || !on(v, x + 1, y) || !on(v, x, y - 1) || !on(v, x, y + 1))) { setp(x, y, c); setp(x + 1, y, c); } };
  edge(old, [214, 50, 50]); edge(nu, [20, 150, 60]);
  const f3 = (n: number): string => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(3), e1 = skullExcess(old.s), e2 = skullExcess(nu.s), o1 = hostOverlap(old.s, new HeadRenders(old.s).at(0, true))!, o2 = hostOverlap(nu.s, new HeadRenders(nu.s).at(0, true))!, x = 20 + i * 410;
  b1 += `<image x="${x}" y="50" width="${CW}" height="${CH}" href="data:image/png;base64,${b64(encodePngRgba(CW, CH, rgba))}"/>` + txt(x, 600, `graine ${seed} (hôte chauve)`, 14) + txt(x, 620, `sommet / vertex 2D : ${f3(e1.top)} → ${f3(e2.top)} U`, 13) + txt(x, 638, `demi-largeur / contour 2D : ${f3(e1.width)} → ${f3(e2.width)} U`, 13) + txt(x, 656, `IoU ${o1.iou.toFixed(3)} → ${o2.iou.toFixed(3)} · peau ${o1.skinCover.toFixed(3)} → ${o2.skinCover.toFixed(3)}`, 12, '#aab3c8');
  void sc;
});
sheet('01-silhouette-ancien-vs-nu', 1680, 680, b1);

// ---------- 02 : tête entière de l'hôte en rotation (crâne nu + coque de cheveux) ----------
let b2 = txt(20, 28, 'Tête entière de l\'hôte (crâne nu, volume de cheveux, yeux, oreilles, cou) : lacet 0 → 180°, tangage 0°', 17);
[42, 3, 11].forEach((seed, r) => [0, 35, 70, 90, 135, 180].forEach((yaw, c) => {
  const s = hostScene(seed, { yaw, pitch: 0, transform: { x: 400, y: 120, scale: 1.4 } }, { x: -3000, y: -3000 }), id = `c${r}${c}`;
  b2 += `<g transform="translate(${20 + c * 330} ${50 + r * 400})"><clipPath id="${id}"><rect x="0" y="0" width="320" height="380"/></clipPath><g clip-path="url(#${id})"><rect width="320" height="380" fill="#ffffff"/><g transform="translate(${-(160 - 20)} ${-(100 - 20)}) scale(0.66)"><g transform="translate(0 0)">${s.svg.slice(s.svg.indexOf('>') + 1, s.svg.lastIndexOf('</svg>'))}</g></g></g></g>` + `<rect x="${24 + c * 330}" y="${58 + r * 400}" width="150" height="17" rx="3" fill="#ffffff" opacity="0.9"/>` + txt(28 + c * 330, 71 + r * 400, `graine ${seed} · lacet ${yaw}°`, 12, '#1d2233');
}));
sheet('02-tete-hote-rotation', 2020, 1260, b2);

// ---------- 03 : profil 2D qui lit la voûte ----------
const p = generateRandomProfile(3), H3 = 400, KEYS: [string, object][] = [['frontalFlat', {}], ['parietalBulge', {}], ['parietalFlat', {}], ['occipitalFlat', {}], ['occipitalSlope', {}], ['parietalHeight', { parietalBulge: 1 }], ['parietalAzimuth', { parietalBulge: 1 }], ['glabella', {}], ['nuchalLine', {}]];
const poly = (ov: object) => skullGeometry(p.face.params, SkullParams.parse({ ...p.skull, ...ov }), H3).poly;
const path = (q: readonly { x: number; y: number }[]): string => `M${q.map((v) => `${v.x.toFixed(1)} ${v.y.toFixed(1)}`).join('L')}Z`;
let b3 = txt(20, 28, 'Profil 2D (src/skull) : contour nominal (gris), −1 (bleu), +1 (orange) — mesures de voûte qui changent la profondeur ou la hauteur', 17);
KEYS.forEach(([k, ex], i) => {
  const lo = poly({ ...ex, [k]: -1 }), hi = poly({ ...ex, [k]: 1 }), nom = poly(ex), all = [...lo, ...hi, ...nom], x0 = Math.min(...all.map((q) => q.x)), y0 = Math.min(...all.map((q) => q.y)), col = i % 3, row = Math.floor(i / 3), ox = 20 + col * 500, oy = 50 + row * 380, K = 1.25, id = `p${i}`;
  b3 += `<clipPath id="${id}"><rect x="${ox}" y="${oy}" width="480" height="320"/></clipPath><rect x="${ox}" y="${oy}" width="480" height="320" fill="#1f2433"/><g clip-path="url(#${id})"><g transform="translate(${ox + 12 - x0 * K} ${oy + 14 - y0 * K}) scale(${K})"><path d="${path(nom)}" fill="#f2f3f7" stroke="#8d94a8" stroke-width="1.5"/><path d="${path(lo)}" fill="none" stroke="#4aa3ff" stroke-width="2"/><path d="${path(hi)}" fill="none" stroke="#ff9a3c" stroke-width="2"/></g></g>` + txt(ox, oy + 342, `${k}${Object.keys(ex).length ? ' (avec éminence pariétale active)' : ''}`, 14);
});
sheet('03-profil-2d-lit-la-voute', 1520, 1200, b3);
console.log('ok', OUT);
