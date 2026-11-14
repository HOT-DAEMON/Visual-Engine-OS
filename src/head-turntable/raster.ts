import { project, toCam } from './math';
import { PART, type Mesh } from './mesh';
import type { View } from './types';

/** Cadre image : taille (px), échelle (px par U) et position image du pivot (x = 0, y = 0 du repère tête). */
export interface Frame { readonly w: number; readonly h: number; readonly ppu: number; readonly ox: number; readonly oy: number }

/** Tampon géométrique : profondeur (grand = proche), partie, position et normale dans le repère de la TÊTE, par pixel. */
export interface GBuf { readonly w: number; readonly h: number; readonly depth: Float32Array; readonly id: Uint8Array; readonly P: Float32Array; readonly N: Float32Array; /** Coordonnées de texture (u, v) par pixel, si le maillage en porte. */ readonly uv: Float32Array }

/** Rastérisation avec test de profondeur ; interpolation barycentrique des positions et des normales (PERSPECTIVE-CORRECTE si `view.persp`, sinon orthographique : chemin d'origine). Pur et déterministe. */
export function rasterize(meshes: readonly Mesh[], view: View, f: Frame, neckClipY?: number): GBuf {
  const { w, h } = f, n = w * h;
  const g: GBuf = { w, h, depth: new Float32Array(n).fill(-Infinity), id: new Uint8Array(n), P: new Float32Array(n * 3), N: new Float32Array(n * 3), uv: new Float32Array(n * 2) };
  for (const m of meshes) {
    const limb = m.id === PART.neck || m.id === PART.neckCut ? 'neck' : 'head', clipRow = limb === 'neck' && neckClipY !== undefined ? Math.floor(neckClipY - 0.5) : Infinity, C = m.P.map((p) => { const c = project(toCam(p, view, limb), view); return { x: f.ox + c.x * f.ppu, y: f.oy + c.y * f.ppu, z: c.z, iw: c.iw }; });
    for (const [i0, i1, i2] of m.T) {
      const a = C[i0]!, b = C[i1]!, c = C[i2]!;
      const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(den) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)), clipRow);
      const pa = m.P[i0]!, pb = m.P[i1]!, pc = m.P[i2]!, na = m.N[i0]!, nb = m.N[i1]!, nc = m.N[i2]!, ua = m.UV?.[i0], ub = m.UV?.[i1], uc = m.UV?.[i2];
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const l0 = ((b.y - c.y) * (qx - c.x) + (c.x - b.x) * (qy - c.y)) / den, l1 = ((c.y - a.y) * (qx - c.x) + (a.x - c.x) * (qy - c.y)) / den, l2 = 1 - l0 - l1;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        // Perspective : les poids écran sont corrigés par 1/w (les attributs varient linéairement dans l'espace, pas dans l'image) ; orthographique : poids écran, chemin d'origine.
        let m0 = l0, m1 = l1, m2 = l2;
        if (view.persp) { const q0 = l0 * a.iw, q1 = l1 * b.iw, q2 = l2 * c.iw, qs = q0 + q1 + q2; m0 = q0 / qs; m1 = q1 / qs; m2 = q2 / qs; }
        const z = m0 * a.z + m1 * b.z + m2 * c.z, k = py * w + px;
        if (z <= g.depth[k]!) continue;
        if (m.clip && !m.clip({ x: m0 * pa.x + m1 * pb.x + m2 * pc.x, y: m0 * pa.y + m1 * pb.y + m2 * pc.y, z: m0 * pa.z + m1 * pb.z + m2 * pc.z })) continue;
        g.depth[k] = z; g.id[k] = m.id;
        g.P[3 * k] = m0 * pa.x + m1 * pb.x + m2 * pc.x; g.P[3 * k + 1] = m0 * pa.y + m1 * pb.y + m2 * pc.y; g.P[3 * k + 2] = m0 * pa.z + m1 * pb.z + m2 * pc.z;
        if (ua && ub && uc) { g.uv[2 * k] = m0 * ua[0] + m1 * ub[0] + m2 * uc[0]; g.uv[2 * k + 1] = m0 * ua[1] + m1 * ub[1] + m2 * uc[1]; }
        g.N[3 * k] = m0 * na.x + m1 * nb.x + m2 * nc.x; g.N[3 * k + 1] = m0 * na.y + m1 * nb.y + m2 * nc.y; g.N[3 * k + 2] = m0 * na.z + m1 * nb.z + m2 * nc.z;
      }
    }
  }
  return g;
}
