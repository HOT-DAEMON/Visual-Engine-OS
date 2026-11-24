import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { deflateSync } from 'node:zlib';
import { compileScene, generateRandomFace, renderScene } from '../src';
import { corneaWarp } from '../src/geometry/eye';
import { verifyEye } from '../src/verify/eye';
import { atomMetrics } from './lib/eye-iris-atoms';
import { irisTone } from './lib/eye-iris-tone';
import { measurePupilRadiusPx } from './lib/verify-eye-cornea-render';
import { BASE } from './lib/eye-param-sweeps';
import { famEye } from './eye-refs/calibrate-atoms-lib';

/**
 * Artefacts de la PASSE 16 : `npx tsx scripts/artefacts-eyes-pass16.ts` → `artefacts/eyes-pass16/` (+ rapport.json).
 *   01-02 : TÊTES ENTIÈRES (graine 11) aux yeux émeraude / feu de la passe, lacet 0° et 25°, + gros plan des yeux ; 10 : réfraction 0 / 1 / 3 (mesure de pupille en pixels) ;
 *   11 : bords palpébraux 0 / 0,4 / 0,9 ; 12 : LOD automatique à 4 tailles ; 13 : atomes de 07 et 10a avant / après (mêmes yeux, paramètres de la passe remis à leur défaut).
 */
const OUT = 'artefacts/eyes-pass16'; mkdirSync(OUT, { recursive: true });
const BG = '#f4ede6';
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer): number => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer): Buffer => { const h = Buffer.alloc(8); h.writeUInt32BE(d.length, 0); h.write(t, 4, 'ascii'); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([h.subarray(4), d])), 0); return Buffer.concat([h, d, tail]); };
function cropPng(svg: string, scale: number, x0: number, y0: number, w: number, h: number): Buffer {
  const img = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, background: BG }).render(); const px = img.pixels as unknown as Uint8Array; const W = img.width;
  const cw = Math.round(w * scale), ch = Math.round(h * scale), ox = Math.round(x0 * scale), oy = Math.round(y0 * scale); const raw = Buffer.alloc((cw * 4 + 1) * ch);
  for (let y = 0; y < ch; y++) { raw[y * (cw * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + ((oy + y) * W + ox) * 4, cw * 4).copy(raw, y * (cw * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw, 0); ihdr.writeUInt32BE(ch, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const png = (svg: string, w?: number): Buffer => Buffer.from(new Resvg(svg, { ...(w ? { fitTo: { mode: 'width' as const, value: w } } : {}), background: BG, font: { loadSystemFonts: true } }).render().asPng());
const b64 = (b: Buffer): string => `data:image/png;base64,${b.toString('base64')}`;
const T = (x: number, y: number, t: string, s = 15): string => `<text x="${x}" y="${y}" font-size="${s}" font-family="DejaVu Sans" fill="#222">${t}</text>`;
const report: Record<string, unknown> = {};

/** Plan serré d'un œil seul (1 unité = 1 px à pixelRatio 1). */
const eyeScene = (eye: Record<string, unknown>, scale = 2.2, W = 480, H = 400, pixelRatio = 1): string => {
  const r: any = compileScene({ width: W, height: H, background: BG, objects: [{ kind: 'eye', id: 'z', transform: { x: W / 2, y: H / 2 + 4, scale }, ...eye, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n')); return pixelRatio === 1 ? r.svg : renderScene(r.scene, { pixelRatio });
};
/** Planche : cases de même taille avec légendes. */
function sheet(file: string, cells: { svg?: string; img?: Buffer; label: string }[], cw: number, ch: number, cols: number): void {
  const rows = Math.ceil(cells.length / cols); const W = cols * (cw + 10) + 10; const H = rows * (ch + 34) + 10; let body = '';
  cells.forEach((c, i) => { const x = 10 + (i % cols) * (cw + 10); const y = 10 + Math.floor(i / cols) * (ch + 34); body += `<image href="${b64(c.img ?? png(c.svg!, cw))}" x="${x}" y="${y + 24}" width="${cw}" height="${ch}"/>${T(x, y + 16, c.label, 13)}`; });
  writeFileSync(`${OUT}/${file}`, png(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${BG}"/>${body}</svg>`));
}

// ── 01-02 : têtes entières ────────────────────────────────────────────────────────────────────────────────────────
const irisOf = (f: 'emerald-facets' | 'fire-halo'): Record<string, unknown> => { const e = famEye(f) as any; return { iris: e.iris, pupil: e.pupil, highlights: e.highlights }; };
const FEATURES = { cornea: { refraction: 1.2, haze: 0.5 }, microdetail: { edge: { irregularity: 0.45, grain: 0.5 }, vessels: { density: 0.5, thickness: 0.4, tint: '#c4574e', visibility: 0.35, branching: 0.6 }, imperfections: 4 } };
function head(f: 'emerald-facets' | 'fire-halo', yaw: number): string {
  const g = generateRandomFace(11, { id: 'f0', transform: { x: 400, y: 400, scale: 1 } } as never);
  (g.objects[0] as any).face = { ...(g.objects[0] as any).face, headPose: { yawDeg: yaw } };
  for (const o of g.objects as any[]) if (o.kind === 'eye') Object.assign(o, irisOf(f), FEATURES, { archetype: null });   // le visage tiré a l'archétype `feline`, qui impose une pupille en fente par-dessus l'iris de la famille
  const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg;
}
for (const [n, f] of [['01-tete-emeraude', 'emerald-facets'], ['02-tete-feu', 'fire-halo']] as const) {
  const cells: { img: Buffer; label: string }[] = [];
  for (const yaw of [0, 25]) { const svg = head(f, yaw); cells.push({ img: png(svg, 520), label: `${f} — tête entière, lacet ${yaw}°` }); cells.push({ img: cropPng(svg, 4, 290, 372, 250, 100), label: `gros plan yeux, lacet ${yaw}° (×4)` }); }
  sheet(`${n}.png`, cells, 520, 520, 2);
}

// ── 10 : réfraction ───────────────────────────────────────────────────────────────────────────────────────────────
// Ligne 1 : œil émeraude de la famille, rayon de pupille PRÉDIT par la loi (la mesure en pixels exige une pupille nettement plus sombre que l'iris voisin : vrai pour l'œil de test BASE,
// faux pour le feu, où elle donne 0 px) ; ligne 2 : œil de test BASE, rayon MESURÉ sur l'image.
{
  const shape = { ...(BASE.shape as object), width: 420, height: 240 }; const cells: { svg: string; label: string }[] = []; const rows: unknown[] = []; const fam = famEye('emerald-facets') as any;
  const w = (k: number): ((r: number) => number) => corneaWarp({ curvature: 0.76, depth: 0.61, index: 1.376, strength: k });
  const size = fam.pupil.size as number;
  for (const k of [0, 1, 3]) cells.push({ svg: eyeScene({ ...fam, cornea: k === 0 ? null : { refraction: k, haze: 0.6 } }, 2.0), label: `émeraude, réfraction ${k} — pupille ×${(w(k)(size) / size).toFixed(2)} (loi)` });
  for (const k of [0, 1, 3]) {
    const co = k === 0 ? null : { refraction: k, haze: 0.6 }; const m = measurePupilRadiusPx({ ...BASE, shape, cornea: co });
    rows.push({ refraction: k, pupilRadiusMeasuredPx: m.measured, pupilRadiusPredictedPx: +m.predicted.toFixed(2), trueRadiusPx: +m.trueRadius.toFixed(2) });
    cells.push({ svg: eyeScene({ ...BASE, shape, cornea: co }, 1.0), label: `œil de test, réfraction ${k} — pupille MESURÉE ${m.measured.toFixed(1)} px (loi ${m.predicted.toFixed(1)})` });
  }
  const wh = w(1); report.refraction = { rows, warpHumain: [0.1, 0.25, 0.5, 0.75, 1].map((r) => [r, +wh(r).toFixed(4)]) };
  sheet('10-cornee-refraction.png', cells, 480, 400, 3);
}

// ── 11 : bords palpébraux ─────────────────────────────────────────────────────────────────────────────────────────
{
  const cells = [0, 0.4, 0.9].map((k) => ({ svg: eyeScene({ ...(famEye('emerald-facets') as object), microdetail: { edge: k === 0 ? null : { irregularity: k, grain: 0.6 }, vessels: null, chroma: null, tearFilm: null, occlusion: 0 } }, 2.0), label: k === 0 ? 'bord parfait (null)' : `irregularity ${k}, grain 0,6` }));
  report.bords = [0.4, 0.9].map((k) => ({ irregularity: k, verify: verifyEye({ kind: 'eye', id: 'e', ...(famEye('emerald-facets') as object), microdetail: { edge: { irregularity: k, grain: 0.6 } } } as never).failures.length }));
  sheet('11-bords-palpebraux.png', cells, 480, 400, 3);
}

// ── 12 : LOD automatique ──────────────────────────────────────────────────────────────────────────────────────────
{
  const e = { ...(famEye('fire-halo') as object), shape: { width: 300, height: 170 }, microdetail: { vessels: { density: 0.9, thickness: 0.5, tint: '#c4574e', visibility: 0.6, branching: 0.8 }, imperfections: 6 } }; const cells: { img: Buffer; label: string }[] = []; const rows: unknown[] = [];
  for (const px of [300, 150, 70, 34]) {
    const scale = px / 300; const svg = eyeScene(e, scale, 420, 280); const nodes = (svg.match(/<(path|circle|ellipse|rect|line|polygon)[ >/]/g) ?? []).length; rows.push({ eyePixels: px, svgNodes: nodes, bytes: svg.length });
    cells.push({ img: cropPng(svg, 2.4, 0, 0, 420, 280), label: `œil de ${px} px — ${nodes} nœuds SVG (×2,4)` });
  }
  report.lod = rows; sheet('12-lod-automatique.png', cells, 504, 336, 2);
}

// ── 13 : atomes 07 / 10a avant / après ────────────────────────────────────────────────────────────────────────────
{
  const strip = (e: any): void => { const d = e.iris.detail; if (d.facets) { delete d.facets.shard; delete d.facets.dust; } if (d.bubbles) { delete d.bubbles.sizeSpread; delete d.bubbles.rim; } if (d.embers) { delete d.embers.shape; delete d.embers.scatter; } };
  const cells: { svg: string; label: string }[] = []; const rows: Record<string, unknown> = {};
  for (const f of ['emerald-facets', 'fire-halo'] as const) {
    const after = famEye(f) as any; const before = structuredClone(after); strip(before);
    if (f === 'emerald-facets') { Object.assign(before.iris.detail.bubbles, { count: 18, size: 0.105 }); before.iris.lift = 0.93; before.iris.vibrance = 0.137; }
    if (f === 'fire-halo') { before.iris.detail.voids = before.iris.detail.voids.slice(0, 1); Object.assign(before.iris.detail.embers, { count: 18, size: 0.012, streak: 0.8 }); }
    for (const [n, e] of [['avant', before], ['après', after]] as const) { cells.push({ svg: eyeScene(e, 2.0), label: `${f} — ${n}` }); const t = irisTone({ kind: 'eye', id: 'e', ...e } as never); const s = atomMetrics({ kind: 'eye', id: 'e', ...e } as never).stars; rows[`${f}:${n}`] = { darkShare: +t.darkShare.toFixed(3), lumMean: +t.lumMean.toFixed(1), satPeaks: +t.satPeaks.toFixed(3), feretTop6Mean: +(s.feretTop6Mean as number).toFixed(3) }; }
  }
  report.atomes = rows; sheet('13-atomes-07-10a-avant-apres.png', cells, 480, 400, 2);
}
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(report, null, 2)); console.log('passe 16 : artefacts écrits');
