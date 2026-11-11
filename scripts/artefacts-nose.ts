import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { cellSvg, board, type CellSpec } from './lib/board';
import { rasterPng } from './lib/raster';
import { lightModelOf, litHead } from '../src/relief';
import { faceLandmarks, noseGeometry, noseArchetype, widthProfile25 } from '../src/face';
import { FaceParams } from '../src/schema';
import { NOSE_FIT } from '../src/face/nose/archetypes.generated';

/**
 * Artefacts du moteur de nez : `npx tsx scripts/artefacts-nose.ts` → artefacts/nez/. Rendus réels, jamais retouchés.
 * 01 silhouettes de référence (mesurées sur 06.png) face à la silhouette du moteur ajustée ; 02 les 8 axes (bas/haut) ÉCLAIRÉS par le moteur de lumière
 * unique, avec la part de pixels qui changent réellement ; 03 la tête complète avec les deux archétypes reproductibles.
 */
const OUT = 'artefacts/nez'; mkdirSync(OUT, { recursive: true });
const S = { anatomyEngine: 'structured' } as const, SEED = 321;
const LIGHT = { azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 };
const model = lightModelOf(LIGHT, { style: 'soft' });
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Cellule éclairée : la scène du moteur de visage + la couche de lumière du moteur de relief (même peau, même lumière). */
function litCell(spec: CellSpec, w: number, h: number) {
  const { svg, meta } = cellSvg({ seed: SEED, ...spec, patch: { ...S, ...(spec.patch ?? {}) }, light: LIGHT }, w, h);
  const host = { face: meta.params, width: meta.face.width, height: meta.face.height }, skin = (meta.face.objects[0] as { material: { color: string } }).material.color;
  const lit = litHead(svg, { ...host }, skin, model).svg;
  return { svg: lit, meta };
}
const pixels = (svg: string): Uint8Array => new Resvg(svg).render().pixels;
const lum = (px: Uint8Array, i: number): number => 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;

// ── 01 : silhouettes de référence vs moteur ───────────────────────────────────────────────
{
  const refs = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { aspectWoverH: number; widthProfile25: number[] }[];
  const names = ['pyramide', 'ellipse-large', 'cloche-ailes', 'plat-trapeze', 'losange-petit'] as const;
  const cw = 250; let body = '';
  names.forEach((n, i) => {
    const x0 = 20 + i * (cw + 10), r = refs[i]!, fit = NOSE_FIT[n];
    const patch: Record<string, unknown> = { ...S, ...noseArchetype(n as never) };
    const flat = fit.params as Record<string, number>; const full: Record<string, any> = { ...S };
    for (const [path, v] of Object.entries(flat)) { const ks = path.split('.'); let c = full; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v; }
    void patch;
    const p = FaceParams.parse(full), m = widthProfile25(noseGeometry(p, faceLandmarks(p, 300, 380)).silhouette);
    const H = 240, Wd = H * r.aspectWoverH * 0.5, Wm = H * m.aspect * 0.5, cx = x0 + cw / 2, y0 = 60;
    const outline = (prof: readonly number[], half: number): string => { const pts = prof.map((w, k) => [cx + (w * half), y0 + (0.02 + 0.96 * (k / 24)) * H]); const left = [...pts].reverse().map(([x, y]) => [2 * cx - x!, y!]); return [...pts, ...left].map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join(' '); };
    body += `<polygon points="${outline(r.widthProfile25, Wd)}" fill="#c77dff" fill-opacity="0.35" stroke="#c77dff" stroke-width="2"/><polygon points="${outline(m.profile, Wm)}" fill="none" stroke="#ffd54f" stroke-width="2.2" stroke-dasharray="6 4"/>`;
    body += `<text x="${cx}" y="${y0 + H + 28}" fill="#e8ecf5" font-family="DejaVu Sans" font-size="14" text-anchor="middle">${esc(n)}</text><text x="${cx}" y="${y0 + H + 48}" fill="${fit.residual <= 0.15 ? '#a5d6a7' : '#ef9a9a'}" font-family="DejaVu Sans" font-size="12" text-anchor="middle">résidu ${fit.residual} · L/H ${fit.aspect} (réf ${fit.refAspect})</text><text x="${cx}" y="${y0 + H + 66}" fill="#9aa4bd" font-family="DejaVu Sans" font-size="11" text-anchor="middle">${fit.residual <= 0.15 ? 'reproduit par le moteur' : 'NON reproductible de face'}</text>`;
  });
  const W = 20 + 5 * (cw + 10), Hh = 420;
  writeFileSync(`${OUT}/01-silhouettes-references.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}"><rect width="${W}" height="${Hh}" fill="#1b1f2e"/><text x="14" y="30" fill="#fff" font-family="DejaVu Sans" font-size="18" font-weight="bold">Silhouettes MESURÉES sur references/nez/06.png (violet) et silhouette du moteur ajustée (jaune pointillé) — 72 % du haut comparés</text>${body}</svg>`, { fonts: true }));
}

// ── 02 : 8 axes, bas / haut, éclairés ───────────────────────────────────────────────────
const metrics: Record<string, unknown> = {};
{
  const V: [string, object, object][] = [
    ['pente des parois', { nose: { sidewall: { slope: 0.05 } } }, { nose: { sidewall: { slope: 0.95 } } }],
    ['gouttière des parois', { nose: { sidewall: { concavity: 0 } } }, { nose: { sidewall: { concavity: 1 } } }],
    ['relief des dômes', { nose: { domes: { prominence: 0.05 } } }, { nose: { domes: { prominence: 0.95 } } }],
    ['séparation des dômes', { nose: { domes: { separation: 0.05 } } }, { nose: { domes: { separation: 0.95 } } }],
    ['volume des ailes', { nose: { alae: { volume: 0.05 } } }, { nose: { alae: { volume: 0.95 } } }],
    ['ouverture des narines', { nose: { nostrils: { opening: 0.05 } } }, { nose: { nostrils: { opening: 0.95 } } }],
    ['sillon alaire', { nose: { groove: { depth: 0 } } }, { nose: { groove: { depth: 1 } } }],
    ['projection de la pointe', { nose: { tip: { projection: 0.05 } } }, { nose: { tip: { projection: 0.95 } } }],
  ];
  const w = 300, h = 360, cells: { png: Buffer; label: string }[] = [], per: Record<string, unknown> = {};
  for (const [name, lo, hi] of V) {
    const a = litCell({ focus: 'nose', patch: lo as never }, w, h), b = litCell({ focus: 'nose', patch: hi as never }, w, h);
    const pa = pixels(a.svg), pb = pixels(b.svg); let changed = 0, sum = 0, n = 0;
    for (let i = 0; i < pa.length; i += 4) { const d = Math.abs(lum(pa, i) - lum(pb, i)); n++; sum += d; if (d > 6) changed++; }
    per[name] = { pixelsChangesPct: +(100 * changed / n).toFixed(2), deltaLuminanceMoyen: +(sum / n).toFixed(3) };
    cells.push({ png: rasterPng(a.svg, { fonts: true }), label: `${name} — bas` }, { png: rasterPng(b.svg, { fonts: true }), label: `${name} — haut · ${(per[name] as { pixelsChangesPct: number }).pixelsChangesPct} %` });
  }
  metrics.axes = per;
  writeFileSync(`${OUT}/02-axes-eclaires.png`, board('Nez : axes min puis max, éclairés (% = pixels changés)', cells, 4, w, h));
}

// ── 03 : tête complète ───────────────────────────────────────────────────────────────────
{
  const heads: [string, object][] = [['nez par défaut', {}], ['archétype « pyramide » (réf. 06)', noseArchetype('pyramide')], ['archétype « cloche-ailes » (réf. 06)', noseArchetype('cloche-ailes')]];
  const cells: { png: Buffer; label: string }[] = [];
  for (const [label, patch] of heads) for (const focus of ['face', 'nose'] as const) { const c = litCell({ focus, patch: patch as never }, 360, 440); cells.push({ png: rasterPng(c.svg, { fonts: true }), label: `${label} — ${focus === 'face' ? 'tête entière' : 'gros plan'}` }); }
  writeFileSync(`${OUT}/03-tete-complete-archetypes.png`, board('Tête éclairée : nez par défaut et archétypes de la réf. 06', cells, 2, 360, 440));
}
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(JSON.stringify(metrics, null, 1));
