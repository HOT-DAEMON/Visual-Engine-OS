import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/prng';
import { ambientOcclusion, castShadow } from '../src/relief/cast';
import { ambientOcclusionRef, castShadowRef } from './helpers/cast-ref';

/** Les versions optimisées (tables de pas, borne d'arrêt exacte, décalages précalculés) rendent EXACTEMENT les mêmes bits que l'ancien code, sur des champs aléatoires. */
const same = (a: Float32Array, b: Float32Array): boolean => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
function field(rnd: () => number, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h).fill(-Infinity), blobs = 1 + Math.floor(rnd() * 5);
  for (let b = 0; b < blobs; b++) {
    const cx = rnd() * w, cy = rnd() * h, r = 4 + rnd() * Math.min(w, h) * 0.4, top = rnd() * 100;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = Math.hypot(x - cx, y - cy) / r; if (q < 1) { const z = top * Math.sqrt(1 - q * q) + rnd() * 0.3; if (z > d[y * w + x]!) d[y * w + x] = z; } }
  }
  return d;
}
describe('castShadow / ambientOcclusion optimisés ≡ ancien code (bit à bit)', () => {
  it('120 champs aléatoires × lumières variées × options', () => {
    const rnd = mulberry32(7771), norm = (x: number, y: number, z: number) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; };
    for (let i = 0; i < 120; i++) {
      const w = 20 + Math.floor(rnd() * 70), h = 20 + Math.floor(rnd() * 70), g = { x0: 0, y0: 0, ppu: 0.8 + rnd() * 3, w, h }, depth = field(rnd, w, h);
      const el = [0.01, 0.1, 0.4, 0.8, 1.2, 1.5][Math.floor(rnd() * 6)]!, az = rnd() * 2 * Math.PI, dir = norm(Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el));
      const o = { reach: (0.1 + rnd() * 0.6) * w, penumbra: rnd() < 0.2 ? undefined : 0.02 + rnd() * 0.6, growth: rnd() < 0.5 ? undefined : 0.01 + rnd() * 0.08, blur: [0, 1, 2, 3][Math.floor(rnd() * 4)], bias: rnd() < 0.3 ? undefined : rnd() * 0.5 };
      expect(same(castShadow(g, depth, dir, o as never), castShadowRef(g, depth, dir, o as never)), `cast #${i}`).toBe(true);
      const rad = 0.5 + rnd() * 6, rng = 1 + rnd() * 10;
      expect(same(ambientOcclusion(g, depth, rad, rng), ambientOcclusionRef(g, depth, rad, rng)), `ao #${i}`).toBe(true);
    }
  });
  it('cas dégénérés : champ vide, un seul pixel, lumière à l’aplomb ou horizontale', () => {
    const g = { x0: 0, y0: 0, ppu: 2, w: 9, h: 9 }, empty = new Float32Array(81).fill(-Infinity), one = empty.slice(); one[40] = 3;
    for (const d of [empty, one]) for (const dir of [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, { x: 0.6, y: 0, z: 0.8 }]) {
      expect(same(castShadow(g, d, dir, { reach: 8 }), castShadowRef(g, d, dir, { reach: 8 }))).toBe(true);
      expect(same(ambientOcclusion(g, d, 1, 2), ambientOcclusionRef(g, d, 1, 2))).toBe(true);
    }
  });
});
