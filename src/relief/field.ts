/**
 * CHAMP DE RELIEF : une surface vue de face, échantillonnée sur une grille. Mêmes conventions que le G-buffer du corps (`body/volume/pixel.ts`) :
 * x droite, y bas, z vers l'observateur (profondeur plus grande = plus proche) ; `depth = −Infinity` = vide. Les unités sont celles du repère de l'hôte du visage.
 */
export interface ReliefField {
  readonly x0: number; readonly y0: number; readonly ppu: number; readonly w: number; readonly h: number;
  readonly depth: Float32Array; readonly nx: Float32Array; readonly ny: Float32Array; readonly nz: Float32Array;
  /** Région anatomique par pixel (voir `REGION`). */
  readonly region: Uint8Array;
}
export const REGION = { none: 0, skull: 1, orbit: 2, nose: 3, cheek: 4, mouth: 5, chin: 6, ear: 7, neck: 8 } as const;
export const REGION_NAMES = ['none', 'skull', 'orbit', 'nose', 'cheek', 'mouth', 'chin', 'ear', 'neck'] as const;
export interface Grid { readonly x0: number; readonly y0: number; readonly ppu: number; readonly w: number; readonly h: number }
export const gridOf = (b: { x0: number; y0: number; x1: number; y1: number }, ppu: number): Grid => ({ x0: b.x0, y0: b.y0, ppu, w: Math.ceil((b.x1 - b.x0) * ppu), h: Math.ceil((b.y1 - b.y0) * ppu) });
/** Normales par différences centrées sur la profondeur (pente en unités du monde) ; vide si un voisin est vide : normale vers l'observateur. */
export function normalsOf(g: Grid, depth: Float32Array): { nx: Float32Array; ny: Float32Array; nz: Float32Array } {
  const { w, h, ppu } = g, nx = new Float32Array(w * h), ny = new Float32Array(w * h), nz = new Float32Array(w * h).fill(1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x, z = depth[k]!; if (z === -Infinity) continue;
    const l = depth[k - 1]!, r = depth[k + 1]!, u = depth[k - w]!, d = depth[k + w]!;
    const dx = ((r === -Infinity ? z : r) - (l === -Infinity ? z : l)) * ppu * (l === -Infinity || r === -Infinity ? 1 : 0.5), dy = ((d === -Infinity ? z : d) - (u === -Infinity ? z : u)) * ppu * (u === -Infinity || d === -Infinity ? 1 : 0.5);
    const len = Math.hypot(dx, dy, 1); nx[k] = -dx / len; ny[k] = -dy / len; nz[k] = 1 / len;
  }
  return { nx, ny, nz };
}
