import { toCam } from './math';
import type { Mesh } from './mesh';
import type { View } from './types';

/** Cadre image : taille (px), échelle (px par U) et position image du pivot (x = 0, y = 0 du repère tête). */
export interface Frame { readonly w: number; readonly h: number; readonly ppu: number; readonly ox: number; readonly oy: number }

/** Tampon géométrique : profondeur (grand = proche), partie, position et normale dans le repère de la TÊTE, par pixel. */
export interface GBuf { readonly w: number; readonly h: number; readonly depth: Float32Array; readonly id: Uint8Array; readonly P: Float32Array; readonly N: Float32Array; /** Coordonnées de texture (u, v) par pixel, si le maillage en porte. */ readonly uv: Float32Array }

/** Rastérisation orthographique avec test de profondeur ; interpolation barycentrique des positions et des normales. Pur et déterministe. */
export function rasterize(meshes: readonly Mesh[], view: View, f: Frame): GBuf {
  const { w, h } = f, n = w * h;
  const g: GBuf = { w, h, depth: new Float32Array(n).fill(-Infinity), id: new Uint8Array(n), P: new Float32Array(n * 3), N: new Float32Array(n * 3), uv: new Float32Array(n * 2) };
  for (const m of meshes) {
    const C = m.P.map((p) => { const c = toCam(p, view); return { x: f.ox + c.x * f.ppu, y: f.oy + c.y * f.ppu, z: c.z }; });
    for (const [i0, i1, i2] of m.T) {
      const a = C[i0]!, b = C[i1]!, c = C[i2]!;
      const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(den) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      const pa = m.P[i0]!, pb = m.P[i1]!, pc = m.P[i2]!, na = m.N[i0]!, nb = m.N[i1]!, nc = m.N[i2]!, ua = m.UV?.[i0], ub = m.UV?.[i1], uc = m.UV?.[i2];
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const l0 = ((b.y - c.y) * (qx - c.x) + (c.x - b.x) * (qy - c.y)) / den, l1 = ((c.y - a.y) * (qx - c.x) + (a.x - c.x) * (qy - c.y)) / den, l2 = 1 - l0 - l1;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        const z = l0 * a.z + l1 * b.z + l2 * c.z, k = py * w + px;
        if (z <= g.depth[k]!) continue;
        g.depth[k] = z; g.id[k] = m.id;
        g.P[3 * k] = l0 * pa.x + l1 * pb.x + l2 * pc.x; g.P[3 * k + 1] = l0 * pa.y + l1 * pb.y + l2 * pc.y; g.P[3 * k + 2] = l0 * pa.z + l1 * pb.z + l2 * pc.z;
        if (ua && ub && uc) { g.uv[2 * k] = l0 * ua[0] + l1 * ub[0] + l2 * uc[0]; g.uv[2 * k + 1] = l0 * ua[1] + l1 * ub[1] + l2 * uc[1]; }
        g.N[3 * k] = l0 * na.x + l1 * nb.x + l2 * nc.x; g.N[3 * k + 1] = l0 * na.y + l1 * nb.y + l2 * nc.y; g.N[3 * k + 2] = l0 * na.z + l1 * nb.z + l2 * nc.z;
      }
    }
  }
  return g;
}
