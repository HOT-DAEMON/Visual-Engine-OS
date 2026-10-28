import { deflateSync } from 'node:zlib';
/** PNG RGBA 8 bits (zlib Node) pour les images de superposition. */
export function encodeRgbaPng(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Uint8Array): number => { let c = 0xffffffff; for (const v of b) c = (crcT[(c ^ v) & 255] as number) ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (t: string, d: Uint8Array): Uint8Array => { const body = new Uint8Array(4 + d.length); body.set(Uint8Array.from(t, (c) => c.charCodeAt(0)), 0); body.set(d, 4); const o = new Uint8Array(12 + d.length); o.set(u32(d.length), 0); o.set(body, 4); o.set(u32(crc(body)), 8 + d.length); return o; };
  const raw = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', Uint8Array.from([...u32(w), ...u32(h), 8, 6, 0, 0, 0])), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
