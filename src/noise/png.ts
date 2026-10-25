/**
 * Encodeur PNG minimal, SANS dépendance (navigateur et Node) : niveaux de gris 8 bits, blocs DEFLATE « stockés » (non compressés).
 * Le bruit n'est de toute façon pas compressible ; ne pas compresser évite zlib, donc reste pur et déterministe.
 */
const CRC_TABLE = ((): Uint32Array => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (const v of b) c = (CRC_TABLE[(c ^ v) & 0xff] as number) ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const adler32 = (b: Uint8Array): number => { let a = 1; let s = 0; for (const v of b) { a = (a + v) % 65521; s = (s + a) % 65521; } return ((s << 16) | a) >>> 0; };
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = Uint8Array.from(type, (c) => c.charCodeAt(0));
  const body = new Uint8Array(4 + data.length); body.set(t, 0); body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  out.set(u32(data.length), 0); out.set(body, 4); out.set(u32(crc32(body)), 8 + data.length);
  return out;
}

/** PNG niveaux de gris 8 bits de `w × h` pixels (`gray.length === w·h`). */
export function encodeGrayPng(gray: Uint8Array, w: number, h: number, pad = 0): Uint8Array {
  const raw = new Uint8Array(h * (w + 1)); // un octet de filtre (0) par ligne
  for (let y = 0; y < h; y++) raw.set(gray.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const blocks: number[] = [0x78, 0x01];
  const parts: Uint8Array[] = [];
  for (let i = 0; i < raw.length; i += 65535) {
    const n = Math.min(65535, raw.length - i);
    parts.push(Uint8Array.from([i + n >= raw.length ? 1 : 0, n & 255, n >>> 8, ~n & 255, (~n >>> 8) & 255]), raw.subarray(i, i + n));
  }
  const z = [Uint8Array.from(blocks), ...parts, Uint8Array.from(u32(adler32(raw)))];
  const zlen = z.reduce((a, p) => a + p.length, 0);
  const zdata = new Uint8Array(zlen); let o = 0; for (const p of z) { zdata.set(p, o); o += p.length; }
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Uint8Array.from([...u32(w), ...u32(h), 8, 0, 0, 0, 0]));
  const idat = chunk('IDAT', zdata);
  // Remplissage optionnel : un bloc texte `k=<pad>` déplace l'alignement base64 (voir `tile.ts`, évitement de sous-chaînes parasites).
  const text = pad > 0 ? chunk('tEXt', Uint8Array.from(`k\u0000${pad}`, (c) => c.charCodeAt(0))) : new Uint8Array(0);
  const iend = chunk('IEND', new Uint8Array(0));
  const out = new Uint8Array(sig.length + ihdr.length + text.length + idat.length + iend.length);
  let p = 0; for (const c of [sig, ihdr, text, idat, iend]) { out.set(c, p); p += c.length; }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Base64 sans `btoa`/`Buffer` (identique partout). */
export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] as number) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >>> 18) & 63]! + B64[(n >>> 12) & 63]! + (i + 1 < b.length ? B64[(n >>> 6) & 63]! : '=') + (i + 2 < b.length ? B64[n & 63]! : '=');
  }
  return s;
}
