/** COPIE FIGÉE de l'ancien castShadow / blur / ambientOcclusion, conservée comme ORACLE : les versions optimisées de `src/relief/cast.ts` doivent lui être strictement égales (bit à bit). Ne pas modifier. */
import type { P3 } from '../../src/body/volume/vec3';
import type { Grid } from '../../src/relief/field';

interface CastOpts { readonly reach: number; readonly steps?: number; readonly penumbra?: number; readonly bias?: number; readonly blur?: number; readonly growth?: number }
export function castShadowRef(g: Grid, depth: Float32Array, dir: P3, o: CastOpts): Float32Array {
  const out = new Float32Array(g.w * g.h), hl = Math.hypot(dir.x, dir.y); if (dir.z <= 0.02 || hl < 1e-4) return out;
  const dx = dir.x / hl, dy = dir.y / hl, slope = dir.z / hl, steps = o.steps ?? 28, pen = o.penumbra ?? 0.25, bias = o.bias ?? 0.004 * o.reach, eps = 1 / g.ppu;
  // Pas : 1 px près du pixel, puis 3 % de la distance déjà parcourue (la pénombre croît plus vite que le pas : pas d'escalier).
  const ts: number[] = []; for (let t = 1 / g.ppu; t < o.reach; t += Math.max(1, (o.growth ?? 0.03) * t * g.ppu) / g.ppu) ts.push(t); void steps;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const k = y * g.w + x, z = depth[k]!; if (z === -Infinity) continue;
    let s = 0;
    for (const t of ts) {
      const qx = Math.round(x + dx * t * g.ppu), qy = Math.round(y + dy * t * g.ppu);
      if (qx < 0 || qy < 0 || qx >= g.w || qy >= g.h) break;
      const d = depth[qy * g.w + qx]!; if (d === -Infinity) continue;
      const ex = d - (z + slope * t) - bias; if (ex <= 0) continue;
      const o1 = Math.min(1, ex / (pen * t + eps)); if (o1 > s) { s = o1; if (s >= 1) break; }
    }
    out[k] = s;
  }
  return blur(g, out, o.blur ?? 2, depth);
}
/** Flou en boîte (rayon `r` px) limité aux pixels pleins : adoucit l'escalier du bord d'ombre ; avec un seuil de cel, il devient un bord anti-crénelé. */
function blur(g: Grid, a: Float32Array, r: number, depth: Float32Array): Float32Array {
  if (r <= 0) return a;
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= g.w || depth[y * g.w + xx] === -Infinity) continue; s += a[y * g.w + xx]!; n++; } t[y * g.w + x] = n ? s / n : 0; }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= g.h || depth[yy * g.w + x] === -Infinity) continue; s += t[yy * g.w + x]!; n++; } o[y * g.w + x] = n ? s / n : 0; }
  return o;
}
export function ambientOcclusionRef(g: Grid, depth: Float32Array, radius: number, range: number): Float32Array {
  const out = new Float32Array(g.w * g.h), R = Math.max(2, Math.round(radius * g.ppu)), D = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const k = y * g.w + x, z = depth[k]!; if (z === -Infinity) continue;
    let occ = 0, n = 0;
    for (const [dx, dy] of D) for (const r of [R * 0.5, R]) {
      const qx = Math.round(x + dx * r), qy = Math.round(y + dy * r); if (qx < 0 || qy < 0 || qx >= g.w || qy >= g.h) continue;
      const d = depth[qy * g.w + qx]!; n++; if (d !== -Infinity) occ += Math.min(1, Math.max(0, (d - z - 0.1 * range) / range));
    }
    out[k] = n ? Math.min(1, (occ / n) * 2.2) : 0;
  }
  return out;
}
