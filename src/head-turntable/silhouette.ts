import type { TurnRender } from './types';

/** Bords gauche/droit de la silhouette à une hauteur normalisée t (0 = sommet de la tête rendue, 1 = t + H), en U relatifs au pivot. */
export interface SilRow { readonly t: number; readonly left: number; readonly right: number }

/** Profil de silhouette d'un rendu, échantillonné aux mêmes hauteurs que la planche mesurée (mêmes définitions : t depuis le sommet, x depuis l'axe). */
export function silhouetteProfile(r: TurnRender, ts: readonly number[]): SilRow[] {
  let top = -1;
  for (let y = 0; y < r.h && top < 0; y++) for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x]) { top = y; break; }
  const out: SilRow[] = [];
  if (top < 0) return out;
  for (const t of ts) {
    const y = Math.round(top + t * r.ppu);
    if (y >= r.h) continue;
    let l = -1, rr = -1;
    for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x]) { if (l < 0) l = x; rr = x; }
    if (l >= 0) out.push({ t, left: (l - r.originX) / r.ppu, right: (rr + 1 - r.originX) / r.ppu });
  }
  return out;
}

/** Sommet du rendu en px (première ligne couverte) : origine des hauteurs normalisées. */
export function topRow(r: TurnRender): number {
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x]) return y;
  return -1;
}

/** Centre de gravité (x en U depuis le pivot, t depuis le sommet) des pixels qui satisfont `pred(rgba index)`. */
export function centroids(r: TurnRender, pred: (i: number) => boolean, minArea = 12): { x: number; t: number; w: number; area: number }[] {
  const top = topRow(r), seen = new Uint8Array(r.w * r.h), res: { x: number; t: number; w: number; area: number }[] = [];
  for (let s = 0; s < r.w * r.h; s++) {
    if (seen[s] || !pred(4 * s)) continue;
    const st = [s]; seen[s] = 1; let n = 0, sx = 0, sy = 0, x0 = Infinity, x1 = -Infinity;
    while (st.length) {
      const k = st.pop()!, x = k % r.w, y = (k - x) / r.w; n++; sx += x; sy += y; x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= r.w || yy >= r.h) continue;
        const j = yy * r.w + xx;
        if (!seen[j] && pred(4 * j)) { seen[j] = 1; st.push(j); }
      }
    }
    if (n >= minArea) res.push({ x: (sx / n + 0.5 - r.originX) / r.ppu, t: (sy / n + 0.5 - top) / r.ppu, w: (x1 - x0 + 1) / r.ppu, area: n });
  }
  return res.sort((a, b) => a.x - b.x);
}
