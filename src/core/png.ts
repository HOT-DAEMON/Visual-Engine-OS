import { deflateSync } from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b: Buffer): number => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t: string, d: Buffer): Buffer => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
/** PNG RGBA 8 bits depuis des pixels bruts (w·h·4 octets, ligne par ligne). Encodeur minimal sans dépendance (filtre 0, zlib de Node) : pur et déterministe. */
export function encodePngRgba(w: number, h: number, rgba: Uint8Array | Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h), ih = Buffer.alloc(13);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
