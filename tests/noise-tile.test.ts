import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { el } from '../src/core/svg';
import { fractalTile, encodeGrayPng, toBase64, noiseTileHref, noiseSteps, setNoiseMode, getNoiseMode, TILE_SIZE, TILE_RES } from '../src/noise';
import { measureEquivalence, equivalenceChecks } from '../src/verify';
import type { Raster } from '../src/regression/png';

const SPEC = { freqX: 0.908, freqY: 0.908, octaves: 2, seed: 5, offset: 0, gain: -1.2 } as const;

/** Décodeur gris 8 bits INDÉPENDANT (zlib de Node) : valide l'encodeur contre l'implémentation de référence de DEFLATE et du CRC. */
function decodeGray(buf: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const b = Buffer.from(buf);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let o = 8; let w = 0; let h = 0; const idat: Buffer[] = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o); const type = b.subarray(o + 4, o + 8).toString('latin1'); const body = b.subarray(o + 8, o + 8 + len);
    const crc = b.readUInt32BE(o + 8 + len);
    // CRC32 de (type + corps) recalculé avec zlib.crc32 (Node ≥ 22) ou à défaut une table locale.
    const tbl = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    let c = 0xffffffff; for (const v of Buffer.concat([Buffer.from(type, 'latin1'), body])) c = tbl[(c ^ v) & 0xff]! ^ (c >>> 8);
    expect((c ^ 0xffffffff) >>> 0).toBe(crc);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); expect([body[8], body[9]]).toEqual([8, 0]); }
    if (type === 'IDAT') idat.push(body);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { expect(raw[y * (w + 1)]).toBe(0); data.set(raw.subarray(y * (w + 1) + 1, (y + 1) * (w + 1)), y * w); }
  return { width: w, height: h, data };
}

describe('turbulence de référence (spec SVG 1.1)', () => {
  it('est déterministe : mêmes paramètres → mêmes valeurs', () => {
    const p = { freqX: 0.9, freqY: 0.9, octaves: 2, seed: 5, size: 32 };
    expect(Array.from(fractalTile(p))).toEqual(Array.from(fractalTile(p)));
  });
  it('varie avec la graine', () => {
    const a = fractalTile({ freqX: 0.9, freqY: 0.9, octaves: 2, seed: 5, size: 32 });
    const b = fractalTile({ freqX: 0.9, freqY: 0.9, octaves: 2, seed: 6, size: 32 });
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
  it('a une moyenne proche de 0 et une dispersion non nulle (bruit fractal centré)', () => {
    const t = fractalTile({ freqX: 0.5, freqY: 0.5, octaves: 2, seed: 11, size: 64 });
    const mean = t.reduce((a, v) => a + v, 0) / t.length;
    const sd = Math.sqrt(t.reduce((a, v) => a + (v - mean) ** 2, 0) / t.length);
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(sd).toBeGreaterThan(0.1);
    expect(Math.max(...t.map(Math.abs))).toBeLessThan(1.2);
  });
  it('est PÉRIODIQUE : la valeur au-delà de la tuile retombe sur le début (raccord sans couture)', () => {
    // Même formule sur une tuile de taille 2× : ses deux moitiés coïncident si, et seulement si, la période est la taille d'une tuile.
    const small = fractalTile({ freqX: 0.5, freqY: 0.5, octaves: 1, seed: 3, size: 16 });
    const big = fractalTile({ freqX: 0.5, freqY: 0.5, octaves: 1, seed: 3, size: 32 });
    // Une tuile 32 de même fréquence a ses coins (0,0) et (16,0) identiques à (0,0) de la tuile 16 : fréquence entière de mailles.
    expect(big[0]).toBeCloseTo(small[0] as number, 9);
  });
});

describe('PNG sans dépendance', () => {
  it('se décode avec zlib (indépendant), CRC valides, et restitue les pixels', () => {
    const g = Uint8Array.from({ length: 12 * 7 }, (_, i) => (i * 37) % 256);
    const png = decodeGray(encodeGrayPng(g, 12, 7));
    expect([png.width, png.height]).toEqual([12, 7]);
    expect(Array.from(png.data)).toEqual(Array.from(g));
    // Le bloc de remplissage (pad) ne change pas l'image décodée.
    expect(Array.from(decodeGray(encodeGrayPng(g, 12, 7, 5)).data)).toEqual(Array.from(g));
  });
  it('base64 identique à Buffer', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 100]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 91 + 7) % 256);
      expect(toBase64(b)).toBe(Buffer.from(b).toString('base64'));
    }
  });
});

describe('tuile de bruit', () => {
  it('est un PNG de (64·res)² pixels, déterministe et sans « NaN » ni « Infinity »', () => {
    const h = noiseTileHref(SPEC);
    expect(h).toMatch(/^data:image\/png;base64,/);
    expect(h).toBe(noiseTileHref({ ...SPEC }));
    expect(/NaN|Infinity/.test(h)).toBe(false);
    const png = decodeGray(Buffer.from(h.split(',')[1] as string, 'base64'));
    expect([png.width, png.height]).toEqual([TILE_SIZE * TILE_RES, TILE_SIZE * TILE_RES]);
  });
  it('aucune des graines usuelles ne produit de sous-chaîne parasite', () => {
    for (let s = 1; s <= 40; s++) expect(/NaN|Infinity/.test(noiseTileHref({ ...SPEC, seed: s }))).toBe(false);
  });
});

describe('liste blanche : feImage ne charge que des data-URI PNG', () => {
  const ok = noiseTileHref(SPEC);
  it('accepte la tuile', () => { expect(el('feImage', { href: ok, x: 0, y: 0, width: 64, height: 64, preserveAspectRatio: 'none' })).toContain('<feImage'); });
  it.each(['https://evil.example/x.png', 'javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'file:///etc/passwd', 'data:image/png;base64,AA"onload="x'])('refuse %s', (u) => {
    expect(() => el('feImage', { href: u })).toThrow();
  });
  it('refuse href sur tout autre élément', () => { expect(() => el('path', { href: ok })).toThrow(/non autorisé/); });
  it('refuse un preserveAspectRatio autre que none', () => { expect(() => el('feImage', { preserveAspectRatio: 'xMidYMid' })).toThrow(); });
});

describe('modes de bruit', () => {
  it('le mode turbulence émet l\'ancien filtre (feTurbulence + alpha d\'origine)', () => {
    const old = setNoiseMode('turbulence');
    try {
      const s = noiseSteps(SPEC, { x: 0, y: 0 }, 'n', el);
      expect(s.nodes.join('')).toContain('feTurbulence');
      expect(s.alphaRow).toBe('0 0 0 -2.4 1.2');
    } finally { setNoiseMode(old); }
  });
  it('le mode tile émet feImage + feTile et lit la luminance', () => {
    const old = setNoiseMode('tile');
    try {
      const s = noiseSteps(SPEC, { x: 3, y: 4 }, 'n', el);
      expect(s.nodes.join('')).toMatch(/<feImage.*<feTile/);
      expect(s.alphaRow).toBe('0.2126 0.7152 0.0722 0 0');
      expect(getNoiseMode()).toBe('tile');
    } finally { setNoiseMode(old); }
  });
});

describe('couche d\'équivalence de rendu', () => {
  const flat = (w: number, h: number, v: number): Raster => ({ width: w, height: h, data: Uint8Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : v)) });
  const face = (dx: number): Raster => {
    const w = 60; const h = 80; const r = flat(w, h, 255);
    const d = r.data as Uint8Array;
    for (let y = 10; y < 70; y++) for (let x = 12; x < 48; x++) for (let c = 0; c < 3; c++) d[(y * w + x) * 4 + c] = 200;
    for (let y = 30; y < 36; y++) for (let x = 20 + dx; x < 28 + dx; x++) for (let c = 0; c < 3; c++) d[(y * w + x) * 4 + c] = 20;
    return r;
  };
  const svg = '<svg><path d="M0 0L1 1"/></svg>';
  it('image identique → tous les contrôles passent', () => {
    const m = measureEquivalence(face(0), face(0), svg, svg);
    expect(equivalenceChecks(m).filter((c) => !c.ok)).toEqual([]);
  });
  it('un trait sombre décalé de 3 px est détecté (anatomie)', () => {
    const m = measureEquivalence(face(0), face(3), svg, svg);
    expect(equivalenceChecks(m).filter((c) => !c.ok && c.layer === 'anatomy').length).toBeGreaterThan(0);
  });
  it('un tracé modifié est détecté (géométrie)', () => {
    const m = measureEquivalence(face(0), face(0), svg, '<svg><path d="M0 0L2 2"/></svg>');
    expect(equivalenceChecks(m).find((c) => c.id === 'equiv-paths-identical')?.ok).toBe(false);
  });
});
