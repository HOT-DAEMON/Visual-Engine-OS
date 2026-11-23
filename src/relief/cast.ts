import type { P3 } from '../body/volume/vec3';
import type { Grid } from './field';

/**
 * OMBRES PORTÉES par marche de rayon sur le champ de profondeur (technique « contact shadows » / screen-space ray marching, avec pénombre).
 * Pour chaque pixel on avance vers la lumière en ESPACE ÉCRAN ; le rayon monte de `Lz / |Lxy|` par unité horizontale ; si la surface rencontrée
 * dépasse le rayon, le pixel est à l'ombre. La PÉNOMBRE croît avec la distance parcourue (`penumbra` ≈ taille apparente de la source) : un
 * nez projette une ombre nette à la racine et floue à son extrémité, comme dans les références peintes (02, 03, 10).
 */
export interface CastOpts { readonly reach: number; readonly steps?: number; readonly penumbra?: number; readonly bias?: number; readonly blur?: number; readonly growth?: number }
export function castShadow(g: Grid, depth: Float32Array, dir: P3, o: CastOpts): Float32Array {
  const out = new Float32Array(g.w * g.h), hl = Math.hypot(dir.x, dir.y); if (dir.z <= 0.02 || hl < 1e-4) return out;
  const dx = dir.x / hl, dy = dir.y / hl, slope = dir.z / hl, pen = o.penumbra ?? 0.25, bias = o.bias ?? 0.004 * o.reach, eps = 1 / g.ppu;
  // Pas : 1 px près du pixel, puis 3 % de la distance déjà parcourue (la pénombre croît plus vite que le pas : pas d'escalier).
  const ts: number[] = []; for (let t = 1 / g.ppu; t < o.reach; t += Math.max(1, (o.growth ?? 0.03) * t * g.ppu) / g.ppu) ts.push(t);
  // Tables par pas, calculées UNE fois (l'ancienne boucle refaisait ces produits pour chaque pixel). Mêmes expressions, même ordre : mêmes bits (tests/cast-exact.test.ts).
  const n = ts.length, ox = new Float64Array(n), oy = new Float64Array(n), st = new Float64Array(n), pt = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = ts[i]!; ox[i] = dx * t * g.ppu; oy[i] = dy * t * g.ppu; st[i] = slope * t; pt[i] = pen * t + eps; }
  let dmax = -Infinity; for (let k = 0; k < depth.length; k++) if (depth[k]! > dmax) dmax = depth[k]!;
  const w = g.w, h = g.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, z = depth[k]!; if (z === -Infinity) continue;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const base = z + st[i]!;
      // Borne EXACTE : aucun pixel n'est plus profond que `dmax`, et `base` ne fait que croître avec le pas ; dès que `dmax − base − bias ≤ 0`, tous les pas suivants
      // donnent `ex ≤ 0` (l'arrondi flottant est monotone) : ils n'auraient rien changé, on s'arrête.
      if (dmax - base - bias <= 0) break;
      const qx = Math.round(x + ox[i]!), qy = Math.round(y + oy[i]!);
      if (qx < 0 || qy < 0 || qx >= w || qy >= h) break;
      const d = depth[qy * w + qx]!; if (d === -Infinity) continue;
      const ex = d - base - bias; if (ex <= 0) continue;
      const o1 = Math.min(1, ex / pt[i]!); if (o1 > s) { s = o1; if (s >= 1) break; }
    }
    out[k] = s;
  }
  return blur(g, out, o.blur ?? 2, depth);
}
/**
 * Même calcul sur une grille `f` fois plus grossière (profondeur = MAX du bloc : un occulteur n'est jamais perdu), puis suréchantillonnage bilinéaire.
 * Les ombres portées sont basses fréquences : f = 2 divise le temps par ≈ 4 sans écart visible (mesuré : docs/LIGHT-VISIBLE-06-REMAINING.md).
 */
export function castShadowScaled(g: Grid, depth: Float32Array, dir: P3, o: CastOpts, f: number): Float32Array {
  if (f <= 1) return castShadow(g, depth, dir, o);
  const cw = Math.ceil(g.w / f), ch = Math.ceil(g.h / f), cd = new Float32Array(cw * ch).fill(-Infinity);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const z = depth[y * g.w + x]!; const k = ((y / f) | 0) * cw + ((x / f) | 0); if (z > cd[k]!) cd[k] = z; }
  const cg: Grid = { x0: g.x0, y0: g.y0, ppu: g.ppu / f, w: cw, h: ch }, cs = castShadow(cg, cd, dir, o), out = new Float32Array(g.w * g.h);
  for (let y = 0; y < g.h; y++) { const fy = Math.min(ch - 1.001, Math.max(0, (y + 0.5) / f - 0.5)), y0 = fy | 0, ty = fy - y0; for (let x = 0; x < g.w; x++) { const fx = Math.min(cw - 1.001, Math.max(0, (x + 0.5) / f - 0.5)), x0 = fx | 0, tx = fx - x0, a = y0 * cw + x0; out[y * g.w + x] = (cs[a]! * (1 - tx) + cs[a + 1]! * tx) * (1 - ty) + (cs[a + cw]! * (1 - tx) + cs[a + cw + 1]! * tx) * ty; } }
  return out;
}
/** Flou en boîte (rayon `r` px) limité aux pixels pleins : adoucit l'escalier du bord d'ombre ; avec un seuil de cel, il devient un bord anti-crénelé. */
function blur(g: Grid, a: Float32Array, r: number, depth: Float32Array): Float32Array {
  if (r <= 0) return a;
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= g.w || depth[y * g.w + xx] === -Infinity) continue; s += a[y * g.w + xx]!; n++; } t[y * g.w + x] = n ? s / n : 0; }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= g.h || depth[yy * g.w + x] === -Infinity) continue; s += t[yy * g.w + x]!; n++; } o[y * g.w + x] = n ? s / n : 0; }
  return o;
}
/** Occlusion ambiante par horizon : part des voisins (8 directions, 2 rayons) plus proches de l'observateur que le pixel ; ∈ [0,1]. */
export function ambientOcclusion(g: Grid, depth: Float32Array, radius: number, range: number): Float32Array {
  const out = new Float32Array(g.w * g.h), R = Math.max(2, Math.round(radius * g.ppu)), D = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const;
  // 16 prises (8 directions × 2 rayons) : décalages calculés une fois, avec les mêmes produits que l'ancienne boucle (aucun tableau créé par pixel).
  const ox = new Float64Array(16), oy = new Float64Array(16), c0 = 0.1 * range; let m = 0;
  for (const [dx, dy] of D) for (const r of [R * 0.5, R]) { ox[m] = dx * r; oy[m] = dy * r; m++; }
  const w = g.w, h = g.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, z = depth[k]!; if (z === -Infinity) continue;
    let occ = 0, n = 0;
    for (let j = 0; j < 16; j++) {
      const qx = Math.round(x + ox[j]!), qy = Math.round(y + oy[j]!); if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
      const d = depth[qy * w + qx]!; n++; if (d !== -Infinity) occ += Math.min(1, Math.max(0, (d - z - c0) / range));
    }
    out[k] = n ? Math.min(1, (occ / n) * 2.2) : 0;
  }
  return out;
}
