import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { deflateSync } from 'node:zlib';
import { compileScene, renderScene } from '../../src';

/**
 * Outils communs des scripts d'artefacts d'yeux (passes 16+) : rendu resvg → PNG, découpe de gros plans, plan serré d'un œil seul, planches légendées.
 * `makeKit(OUT)` lie les planches au dossier de sortie de la passe.
 */
export function makeKit(OUT: string) {
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
  return { BG, png, b64, T, cropPng, eyeScene, sheet };
}
