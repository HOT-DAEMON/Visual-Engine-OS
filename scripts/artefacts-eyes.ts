import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { performance } from 'node:perf_hooks';
import { crc32, deflateSync } from 'node:zlib';
import { compileScene } from '../src';
import { verifyEye } from '../src/verify';
import { eyeCellSvg, eyeSheetPng } from './lib/eye-sheet';

/** Génère `artefacts/eyes/` : preuves visuelles et chiffrées du chantier yeux (reproductible : `npx tsx scripts/artefacts-eyes.ts`). */
const OUT = 'artefacts/eyes';
mkdirSync(OUT, { recursive: true });
const png = (name: string, buf: Buffer) => { writeFileSync(`${OUT}/${name}`, buf); console.log('✓', name); };
const rasterSvg = (svg: string) => new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'];
const P = { size: 0.34 };

// 01 — Profils de pupille (EYE-05)
png('01-pupilles.png', eyeSheetPng([
  ['ronde', {}], ['fente verticale', { shape: 'slit_vertical' }], ['étoile 5', { shape: 'star', lobes: { count: 5, inner: 0.42 } }], ['losange', { shape: 'diamond' }],
  ['hexagone arrondi', { shape: 'polygon', lobes: { count: 6, rounding: 0.6 } }], ['croix', { shape: 'cross' }], ['trou de serrure', { shape: 'keyhole' }], ['3 pupilles (anneau)', { multiple: { count: 3, scale: 0.45 } }],
  ['orientation 35° + centre décalé', { shape: 'diamond', orientationDeg: 35, center: { x: 0.2, y: 0.1 } }], ['déformée + irrégulière', { deform: { squash: 0.35, skew: 0.25, irregularity: 0.8 } }],
  ['dilatée (lumière 0)', { response: { model: 'circular', light: 0 } }], ['contractée (lumière 1)', { response: { model: 'circular', light: 1 } }],
].map(([label, p]) => ({ label: label as string, eye: { eyebrow: null, highlights: { primary: { size: 0.06, opacity: 1 }, secondary: null }, pupil: { size: 0.4, ...(p as object) } } })), 4, 300, 220)); // reflet réduit : le reflet par défaut masquerait les formes (point restant documenté)

// 02 — Couches de couleur de l'iris (EYE-04)
const ex = (layers: object[]) => ({ eyebrow: null, pupil: P, iris: { layers } });
png('02-iris-couches.png', eyeSheetPng([
  { label: 'bleu + anneau doré', eye: ex([{ color: '#2a6fdb', opacity: 0.9 }, { color: '#e0b030', mask: 'ring', inner: 0.12, outer: 0.5, irregularity: 0.7, feather: 0.5 }]) },
  { label: 'gris + moitié haute turquoise', eye: ex([{ color: '#8a949c', opacity: 0.9 }, { color: '#33d6c4', mask: 'half', gradient: 'radial', color2: '#0f5560', inner: 0.1, feather: 0.6 }]) },
  { label: 'dégradé angulaire bleu / doré', eye: ex([{ color: '#1f5fd0', color2: '#e8b83a', gradient: 'angular', opacity: 0.85, feather: 0.4 }]) },
  { label: 'fantastique : anneaux lumineux', eye: ex([{ color: '#2b0a4a', opacity: 1 }, { color: '#ff3df0', mask: 'ring', inner: 0.4, outer: 0.5, glow: 0.9, feather: 0.2 }, { color: '#3df0ff', mask: 'ring', inner: 0.7, outer: 0.78, glow: 0.9, feather: 0.2 }]) },
  { label: 'taches (spots) ambrées', eye: ex([{ color: '#5a8f3c', opacity: 0.95 }, { color: '#b5782a', mask: 'spot', angleDeg: 120, inner: 0.5, outer: 0.7, spotRadius: 0.25 }, { color: '#b5782a', mask: 'spot', angleDeg: 250, inner: 0.45, outer: 0.65, spotRadius: 0.18 }]) },
  { label: 'multiplier (iris assombri)', eye: ex([{ color: '#4a90d9', opacity: 1 }, { color: '#cc7a3a', mask: 'sector', angleDeg: 180, span: 150, blend: 'multiply', opacity: 0.8, feather: 0.5 }]) },
], 3, 340, 250));

// 03 — Reflets (OPT-01/04)
const hl = (list: object[]) => ({ eyebrow: null, pupil: P, highlights: { list } });
png('03-reflets.png', eyeSheetPng([
  { label: 'physique : suit la lumière (2 reflets)', eye: hl([{ kind: 'reflection', size: 0.2 }, { kind: 'reflection', role: 'secondary', size: 0.1, opacity: 0.7 }]) },
  { label: 'étoile graphique (confinée à l’iris)', eye: hl([{ shape: 'star', anchor: 'iris', x: -0.25, y: -0.3, size: 0.22, confine: 'iris' }]) },
  { label: 'éclat « sparkle » + halo', eye: hl([{ shape: 'sparkle', anchor: 'iris', x: -0.3, y: -0.35, size: 0.3, intensity: 0.8, rotationDeg: 15 }]) },
  { label: 'fenêtre (rectangle losange) douce', eye: hl([{ shape: 'diamond', anchor: 'iris', x: 0.3, y: -0.3, size: 0.18, aspect: 1.6, softness: 0.5 }]) },
  { label: 'ancrage globe (caméra) + ellipse', eye: hl([{ shape: 'ellipse', anchor: 'globe', x: -0.9, y: -0.4, size: 0.12, aspect: 0.5, opacity: 0.7 }]) },
  { label: 'hors zone → ramené dans l’iris', eye: hl([{ anchor: 'iris', x: 1.4, y: 1.4, size: 0.2, confine: 'iris' }]) },
], 3, 340, 250));

// 04 — Microdétails de la sclère (EYE-07) + LOD
const V = { density: 0.85, thickness: 0.5, visibility: 0.65, branching: 0.8 };
png('04-microdetails.png', eyeSheetPng([
  { label: 'sans microdétail', eye: { eyebrow: null, pupil: P } },
  { label: 'complet : vaisseaux, chroma, film, marques', eye: { eyebrow: null, pupil: P, microdetail: { vessels: V, imperfections: 3 } } },
  { label: 'LOD : œil de 60 px', eye: { eyebrow: null, pupil: P, microdetail: { vessels: V, imperfections: 3, lod: { eyePixels: 60 } } } },
  { label: 'film lacrymal fort seul', eye: { eyebrow: null, pupil: P, microdetail: { vessels: null, chroma: null, tearFilm: { wetness: 1, meniscus: 0.9 }, occlusion: 0.2 } } },
], 2, 420, 300));

// 05 — Rotation 3D : 12 enveloppes, modèle plat (historique) vs sphère, lacet 0° / 40°
const turn = (style: string, model: string, yaw: number) => ({ label: `${style} ${model} ${yaw}°`, eye: { eyebrow: null, pupil: P, shape: { style }, headTurn: { model, yawDeg: yaw, azimuthDeg: -22 } } });
png('05-rotation3d-12-enveloppes.png', eyeSheetPng(STYLES.flatMap((s) => [turn(s, 'sphere', 0), turn(s, 'sphere', 40), turn(s, 'flat', 40)]), 6, 240, 190));

// 06 — Moteur d'apparence branché sur l'œil
png('06-apparence.png', eyeSheetPng([
  { label: 'sans apparence', eye: { eyebrow: null, pupil: P } },
  { label: 'ombre bleutée + contour', eye: { eyebrow: null, pupil: P, appearance: { light: { shadow: '#1a3a7a', rimStrength: 0.8 } } } },
  { label: 'glow + bloom (iris)', eye: { eyebrow: null, pupil: P, appearance: { glow: { intensity: 0.7, radius: 0.5 }, bloom: { intensity: 0.5 } } } },
  { label: 'étalonnage : contraste+, saturation+', eye: { eyebrow: null, pupil: P, appearance: { contrast: 0.3, saturation: 0.35 } } },
  { label: 'émission turquoise', eye: { eyebrow: null, pupil: P, appearance: { emission: { color: '#66ffee', intensity: 0.7 } } } },
  { label: 'reflet teinté or', eye: { eyebrow: null, pupil: P, appearance: { reflection: { tint: '#ffcc33' } } } },
], 3, 340, 250));

// 07 — Œil « tout ensemble » (intégration de tous les systèmes)
const ALL: Record<string, unknown> = {
  seed: 11, eyebrow: null, pupil: { shape: 'star', size: 0.34, lobes: { count: 6, inner: 0.5, rounding: 0.4 }, edge: { softness: 0.25, tint: '#7fe6ff', tintOpacity: 0.4 } },
  iris: { layers: [{ color: '#1f5fd0', color2: '#8a2be2', gradient: 'angular', opacity: 0.85 }, { color: '#e0b030', mask: 'ring', inner: 0.2, outer: 0.5, irregularity: 0.6, glow: 0.4 }] },
  highlights: { list: [{ kind: 'reflection', size: 0.18 }, { shape: 'sparkle', anchor: 'iris', x: -0.3, y: -0.35, size: 0.22, intensity: 0.6, confine: 'iris' }] },
  microdetail: { vessels: V, imperfections: 2 }, headTurn: { model: 'sphere', yawDeg: 18, azimuthDeg: 22 }, appearance: { glow: { intensity: 0.3 }, light: { shadow: '#1a2a5a', rimStrength: 0.5 } },
};
png('07-integration-complete.png', eyeSheetPng([{ label: 'tous les systèmes combinés (graine 11)', eye: ALL }, { label: 'même œil, graine 12 (motifs différents)', eye: { ...ALL, seed: 12 } }], 2, 560, 400));

// 08 — Rapport de vérification (géométrie / anatomie / style) — 12 enveloppes + œil complet
const rows = [...STYLES.map((s) => [s, verifyEye({ kind: 'eye', id: 'e', shape: { style: s } })] as const), ['tout combiné', verifyEye({ kind: 'eye', id: 'e', ...ALL })] as const];
const rh = 26;
let tbl = `<rect width="900" height="${60 + rows.length * rh}" fill="#20232f"/><text x="16" y="30" font-family="DejaVu Sans" font-size="16" fill="#e8ecff">verifyEye — contrôles chiffrés par couche (✓ réussis / total · ⚠ avertissements)</text>`;
['geometry', 'anatomy', 'style'].forEach((l, i) => { tbl += `<text x="${250 + i * 200}" y="52" font-family="DejaVu Sans" font-size="13" fill="#9fb0ff">${l}</text>`; });
rows.forEach(([name, r], i) => {
  const y = 78 + i * rh;
  tbl += `<text x="16" y="${y}" font-family="DejaVu Sans" font-size="13" fill="#cfd6ee">${esc(name)}</text>`;
  (['geometry', 'anatomy', 'style'] as const).forEach((l, k) => {
    const cs = r.checks.filter((c) => c.layer === l); const ok = cs.filter((c) => c.ok).length; const warn = cs.filter((c) => !c.ok && c.severity === 'warn').length; const err = cs.filter((c) => !c.ok && c.severity === 'error').length;
    tbl += `<text x="${250 + k * 200}" y="${y}" font-family="DejaVu Sans" font-size="13" fill="${err ? '#ff6b6b' : warn ? '#ffd166' : '#7ee787'}">${ok}/${cs.length}${warn ? `  ⚠${warn}` : ''}${err ? `  ✗${err}` : ''}</text>`;
  });
});
png('08-verification.png', rasterSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${60 + rows.length * rh}">${tbl}</svg>`));
writeFileSync(`${OUT}/verification.json`, JSON.stringify(rows.map(([n, r]) => ({ eye: n, ok: r.ok, failures: r.failures.map((c) => c.id), warnings: r.warnings.map((c) => c.id), metrics: r.metrics })), null, 2));

// 09 — Performance : avant (reference = flou SVG historique) / après (fast) + carte d'écart
const W = 1024, H = 768;
const scene = (eye: object) => ({ width: W, height: H, background: '#2b2f3f', objects: [{ kind: 'eye', id: 'e', seed: 4, transform: { x: W / 2, y: H / 2 }, shape: { width: 700, height: 400 }, ...eye }] });
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const time = (eye: object) => { const t: number[] = []; let svg = ''; for (let i = 0; i < 9; i++) { const r: any = compileScene(scene(eye) as never); svg = r.svg; const t0 = performance.now(); new Resvg(svg).render().asPng(); t.push(performance.now() - t0); } return { ms: med(t), kb: svg.length / 1024, filters: (svg.match(/<filter /g) ?? []).length }; };
const empty = (() => { const t: number[] = []; for (let i = 0; i < 9; i++) { const t0 = performance.now(); new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#2b2f3f"/></svg>`).render().asPng(); t.push(performance.now() - t0); } return med(t); })();
const cfgs: [string, object][] = [['œil par défaut', {}], ['+ microdétails', { microdetail: {} }]];
const res = cfgs.map(([n, e]) => ({ n, before: time({ ...e, renderQuality: 'reference' }), after: time({ ...e, renderQuality: 'fast' }) }));
writeFileSync(`${OUT}/perf.json`, JSON.stringify({ resolution: `${W}x${H}`, emptyCanvasMs: +empty.toFixed(1), results: res.map((r) => ({ config: r.n, beforeMs: +r.before.ms.toFixed(1), afterMs: +r.after.ms.toFixed(1), speedup: +(r.before.ms / r.after.ms).toFixed(2), usefulSpeedup: +((r.before.ms - empty) / Math.max(1, r.after.ms - empty)).toFixed(2), beforeFilters: r.before.filters, afterFilters: r.after.filters })) }, null, 2));
let chart = `<rect width="760" height="${90 + res.length * 90}" fill="#20232f"/><text x="16" y="28" font-family="DejaVu Sans" font-size="16" fill="#e8ecff">Rastérisation d’un œil à ${W}×${H} (resvg, médiane de 9) — avant / après</text>`;
res.forEach((r, i) => { const y = 60 + i * 90; const sc = 560 / Math.max(...res.map((x) => x.before.ms)); chart += `<text x="16" y="${y + 14}" font-family="DejaVu Sans" font-size="13" fill="#cfd6ee">${esc(r.n)}</text><rect x="16" y="${y + 22}" width="${r.before.ms * sc}" height="20" fill="#ff7b72"/><text x="${24 + r.before.ms * sc}" y="${y + 37}" font-family="DejaVu Sans" font-size="12" fill="#ffb3ad">${r.before.ms.toFixed(0)} ms · ${r.before.filters} filtre(s)</text><rect x="16" y="${y + 46}" width="${r.after.ms * sc}" height="20" fill="#7ee787"/><text x="${24 + r.after.ms * sc}" y="${y + 61}" font-family="DejaVu Sans" font-size="12" fill="#b6f5bd">${r.after.ms.toFixed(0)} ms · ${r.after.filters} filtre  (×${(r.before.ms / r.after.ms).toFixed(1)})</text>`; });
png('09-performance.png', rasterSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${90 + res.length * 90}">${chart}</svg>`));

const CW = 512, CH = 384;
/** Encodeur PNG RGBA minimal (zlib + CRC32 de Node) — pour la carte de chaleur, que resvg ne sait pas fabriquer depuis des pixels bruts. */
function encodePng(rgba: Uint8Array, w: number, h: number): Buffer {
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0); return Buffer.concat([len, body, crc]); };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const px = (q: string) => new Resvg(eyeCellSvg({ shape: { style: 'almond' }, renderQuality: q }, CW, CH)).render();
const a = px('fast'), b = px('reference');
const ap = a.pixels, bp = b.pixels; // `.pixels` COPIE le tampon à chaque accès : à lire une seule fois
const heat = new Uint8Array(CW * CH * 4);
let sum = 0, mx = 0;
for (let i = 0; i < CW * CH; i++) {
  const d = Math.max(...[0, 1, 2].map((k) => Math.abs((ap[i * 4 + k] as number) - (bp[i * 4 + k] as number))));
  sum += d; mx = Math.max(mx, d);
  heat[i * 4] = Math.min(255, d * 30); heat[i * 4 + 1] = Math.min(255, d * 12); heat[i * 4 + 2] = 40; heat[i * 4 + 3] = 255;
}
const b64 = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString('base64');
const label = (x: number, t: string) => `<text x="${x + 8}" y="${CH + 18}" font-family="DejaVu Sans" font-size="13" fill="#cfd6ee">${esc(t)}</text>`;
png('10-equivalence-fast-vs-reference.png', rasterSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW * 3}" height="${CH + 26}"><rect width="100%" height="100%" fill="#20232f"/>`
  + `<image x="0" width="${CW}" height="${CH}" href="data:image/png;base64,${b64(a.asPng())}"/><image x="${CW}" width="${CW}" height="${CH}" href="data:image/png;base64,${b64(b.asPng())}"/>`
  + `<image x="${CW * 2}" width="${CW}" height="${CH}" href="data:image/png;base64,${b64(encodePng(heat, CW, CH))}"/>`
  + label(0, 'rapide (sans filtre)') + label(CW, 'référence (flou gaussien)') + label(CW * 2, `écart ×30 — moyen ${(sum / (CW * CH)).toFixed(3)}/255, max ${mx}`) + '</svg>'));
