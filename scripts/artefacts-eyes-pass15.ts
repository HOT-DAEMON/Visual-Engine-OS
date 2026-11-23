import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { deflateSync } from 'node:zlib';
import { compileScene, generateRandomFace } from '../src';

/**
 * Artefacts de la PASSE 15 : `npx tsx scripts/artefacts-eyes-pass15.ts <avant|apres|planche>` → `artefacts/eyes-pass15/`
 *   `apres` / `avant` : tête ENTIÈRE (graine 11) à lacet 0°, 25°, 40° (pose du visage = modèle `sphere` des yeux) + gros plan des yeux ; « avant » se génère sur le commit précédent
 *   (git stash de src/render/eye/globe-inner.ts) ; `planche` : assemble avant / après côte à côte.
 */
const OUT = 'artefacts/eyes-pass15'; mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] ?? 'apres'; const YAWS = [0, 25, 40];
const raster = (svg: string, w: number): Buffer => Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: w }, background: '#f4ede6', font: { loadSystemFonts: mode === 'planche' } }).render().asPng());
/** Encodeur PNG minimal (RGBA 8 bits) : resvg plante (unwrap sur None) quand le viewBox est recadré sur une scène à filtres ; on rastérise la scène entière puis on recadre les pixels. */
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer): number => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer): Buffer => { const h = Buffer.alloc(8); h.writeUInt32BE(d.length, 0); h.write(t, 4, 'ascii'); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([h.subarray(4), d])), 0); return Buffer.concat([h, d, tail]); };
function cropPng(svg: string, scale: number, x0: number, y0: number, w: number, h: number): Buffer {
  const img = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, background: '#f4ede6' }).render(); const px = img.pixels as unknown as Uint8Array; const W = img.width;
  const cw = Math.round(w * scale), ch = Math.round(h * scale), ox = Math.round(x0 * scale), oy = Math.round(y0 * scale); const raw = Buffer.alloc((cw * 4 + 1) * ch);
  for (let y = 0; y < ch; y++) { raw[y * (cw * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + ((oy + y) * W + ox) * 4, cw * 4).copy(raw, y * (cw * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw, 0); ihdr.writeUInt32BE(ch, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const b64 = (b: Buffer): string => `data:image/png;base64,${b.toString('base64')}`;
const T = (x: number, y: number, t: string, s = 15): string => `<text x="${x}" y="${y}" font-size="${s}" font-family="DejaVu Sans" fill="#222">${t}</text>`;

if (mode === 'planche') {
  const rows = ['tete', 'yeux'] as const; const CW = 520; const CH = { tete: 520, yeux: 200 }; const GAP = 12; let y = 34; let body = '';
  for (const r of rows) {
    for (const [ri, lab] of [['avant', 'AVANT (reflets hors projection)'], ['apres', 'APRÈS (reflets suivent la matrice sphérique)']] as const) {
      body += T(10, y - 10, `${r === 'tete' ? 'tête entière' : 'gros plan des yeux'} · ${lab}`);
      YAWS.forEach((yaw, i) => { const f = `${OUT}/${r}-${ri}-yaw${yaw}.png`; if (existsSync(f)) body += `<image x="${10 + i * (CW + GAP)}" y="${y}" width="${CW}" height="${CH[r]}" href="${b64(readFileSync(f))}"/>` + T(14 + i * (CW + GAP), y + 18, `lacet ${yaw}°`, 13); });
      y += CH[r] + 40;
    }
  }
  const W = 3 * (CW + GAP) + 8; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="${W}" height="${y}" fill="#f4ede6"/>${body}</svg>`;
  writeFileSync(`${OUT}/00-planche-avant-apres.png`, raster(svg, W)); console.log('planche écrite'); process.exit(0);
}

for (const yaw of YAWS) {
  const f = generateRandomFace(11, { id: 'f0', transform: { x: 400, y: 400, scale: 1 } } as never);
  const host = f.objects[0] as unknown as { face: Record<string, unknown> };
  host.face = { ...host.face, headPose: { yawDeg: yaw } };
  const r: any = compileScene({ width: 800, height: 800, background: '#f4ede6', objects: f.objects } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const svg = r.svg as string;
  writeFileSync(`${OUT}/tete-${mode}-yaw${yaw}.png`, raster(svg, 1040));
  // gros plan : scène entière rastérisée à 2,6×, pixels recadrés sur la bande des yeux
  writeFileSync(`${OUT}/yeux-${mode}-yaw${yaw}.png`, cropPng(svg, 2.6, 200, 270, 400, 154));
}
console.log(mode, 'ok');
