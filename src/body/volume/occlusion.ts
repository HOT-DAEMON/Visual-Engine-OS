import type { GBuffer } from './gbuffer';

/**
 * COUCHE « OCCLUSION + RAINURES » du corps : pour chaque pixel plein, la somme d'abri des voisins plus proches du spectateur (`occ`) et le nombre de voisins d'un
 * autre volume de couche supérieure (`gro`). Elle ne lit que le G-buffer : ni la lumière, ni la peau, ni les réglages d'ombrage. Calculée ici une fois par
 * G-buffer au lieu de l'être dans la boucle d'ombrage à chaque rendu (docs/PERF-4.md). `occ` reste en DOUBLE précision : c'est la valeur exacte de l'ancien calcul
 * en ligne (un `Float32Array` l'aurait arrondie et décalé des pixels) ; `gro` est un petit entier (≤ 16).
 */
export interface Occlusion { readonly occ: Float64Array; readonly gro: Uint8Array }
const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const;

export function occlusionOf(g: GBuffer): Occlusion {
  const { W, Hh, H, ppu, depth, id, meta } = g, N = W * Hh, occA = new Float64Array(N), groA = new Uint8Array(N), R = Math.max(2, Math.round(0.018 * H * ppu));
  // 16 prises (8 directions × 2 rayons) : décalages calculés une fois (mêmes produits que l'ancienne boucle, qui créait un tableau par pixel) ; `near` = rayon R/2.
  const ox = new Float64Array(16), oy = new Float64Array(16), near = new Uint8Array(16); let m = 0;
  for (const [dx, dy] of DIR) for (const r of [R * 0.5, R]) { ox[m] = dx * r; oy[m] = dy * r; near[m] = r === R * 0.5 ? 1 : 0; m++; }
  const c0 = 0.002 * H, c1 = 0.05 * H;
  for (let key = 0; key < N; key++) {
    const vi = id[key]!; if (vi < 0) continue;
    const px = key % W, py = (key / W) | 0, z = depth[key]!, md = meta[vi]!;
    // AO : voisins plus proches du spectateur que ce pixel (relief qui l'abrite) ; rainure : voisin d'un autre volume situé AU-DESSUS (couche supérieure).
    let occ = 0, gro = 0;
    for (let j = 0; j < 16; j++) {
      const qx = Math.round(px + ox[j]!), qy = Math.round(py + oy[j]!); if (qx < 0 || qy < 0 || qx >= W || qy >= Hh) continue;
      const k2 = qy * W + qx, v2 = id[k2]!; if (v2 < 0) continue;
      occ += Math.min(1, Math.max(0, (depth[k2]! - z - c0) / c1));
      if (near[j] === 1 && v2 !== vi) { const m2 = meta[v2]!; if (m2.layer > md.layer && !(md.mass !== undefined && m2.mass === md.mass) && !(md.kind === 'skin' && m2.kind === 'skin')) gro += 1; } // peau/peau : une seule surface (épaule, hanche), pas de rainure (itération 05)
    }
    occA[key] = occ; groA[key] = gro;
  }
  return { occ: occA, gro: groA };
}
