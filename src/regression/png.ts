import { inflateSync } from 'node:zlib';

/**
 * Décodeur PNG minimal et STRICT (sans dépendance) pour les images produites par resvg : 8 bits, RGBA (type 6) ou RGB (type 2),
 * non entrelacé. Toute autre variante lève une erreur explicite (jamais de lecture silencieusement fausse).
 */
export interface Raster { readonly width: number; readonly height: number; /** RGBA, 4 octets par pixel. */ readonly data: Uint8Array }

export function decodePng(buf: Uint8Array): Raster {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (sig.some((b, i) => buf[i] !== b)) throw new Error('PNG : signature invalide');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 8; let width = 0; let height = 0; let depth = 0; let ctype = 0; let interlace = 0;
  const idat: Uint8Array[] = [];
  while (pos < buf.length) {
    const len = dv.getUint32(pos); const type = String.fromCharCode(buf[pos + 4]!, buf[pos + 5]!, buf[pos + 6]!, buf[pos + 7]!);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = dv.getUint32(pos + 8); height = dv.getUint32(pos + 12); depth = body[8]!; ctype = body[9]!; interlace = body[12]!; }
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2) || interlace !== 0) throw new Error(`PNG : variante non gérée (profondeur ${depth}, type ${ctype}, entrelacement ${interlace})`);
  const bpp = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride); const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp]! : 0; const b = prev[x]!; const c = x >= bpp ? prev[x - bpp]! : 0;
      let v = line[x]!;
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) throw new Error(`PNG : filtre ${f} inconnu`);
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) { const o = (y * width + x) * 4; out[o] = cur[x * bpp]!; out[o + 1] = cur[x * bpp + 1]!; out[o + 2] = cur[x * bpp + 2]!; out[o + 3] = bpp === 4 ? cur[x * bpp + 3]! : 255; }
    prev.set(cur);
  }
  return { width, height, data: out };
}
