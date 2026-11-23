import { encodePngRgba } from '../../core/png';
import { parseHex } from '../../core/color';
import { castShadowScaled } from '../../relief/cast';
import { shaderOf, tonesOf, type LightModel, type ShadeOut } from '../../relief/model';
import { hexOf } from '../../relief/oklab';
import type { GBuffer } from './gbuffer';
import type { Occlusion } from './occlusion';
import { DEFAULT_LIGHT, paletteOf, tone, type LightRig } from './shade';
import { p3 } from './vec3';

/**
 * ÉTAGE D'OMBRAGE du rendu par pixel (tout ce qui dépend de la lumière, de la peau et des réglages) : ombre portée du corps (+ occulteur « tête »), éclairage par
 * pixel, sur-échantillonnage, PNG. Extrait tel quel de l'ancien `renderVolumesPixel` : mêmes opérations dans le même ordre ; seule l'occlusion / les rainures sont
 * lues dans la couche précalculée (`occlusion.ts`) au lieu d'être recalculées en ligne.
 */
export interface ShadeOpts {
  readonly skin: string; readonly light?: LightRig; readonly ao?: number; readonly groove?: number; readonly shadowReach?: number;
  readonly proxy?: (x: number, y: number) => number;
}
const hex = (c: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(c); const v = m ? parseInt(m[1] as string, 16) : 0xc99a76; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mixc = (a: number[], b: number[], t: number): number[] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/** Ombre portée du corps : marche de rayon sur la profondeur (tête comprise via `proxy`), grille deux fois plus grossière puis suréchantillonnée. Dépend du G-buffer, du modèle de lumière et de l'occulteur. */
export function bodyCast(g: GBuffer, M: LightModel, o: Pick<ShadeOpts, 'proxy' | 'shadowReach'>): Float32Array {
  const { W, Hh, H, ppu, x0, y0, depth, id } = g, N = W * Hh, comb = new Float32Array(N);
  for (let k = 0; k < N; k++) comb[k] = id[k]! >= 0 ? depth[k]! : -Infinity;
  if (o.proxy) for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) { const z = o.proxy(x0 + (px + 0.5) / ppu, y0 + (py + 0.5) / ppu); if (z > comb[py * W + px]!) comb[py * W + px] = z; }
  return castShadowScaled({ x0, y0, ppu, w: W, h: Hh }, comb, M.dir, { reach: o.shadowReach ?? 1.2 * H, penumbra: 0.06 + 0.4 * M.soft, growth: 0.05, blur: 1 }, 2);
}

/** Éclairage par pixel → RGBA à la résolution sur-échantillonnée (`ss`). `M === null` : ancien éclairage (comparaisons avant/après). */
export function shadePixels(g: GBuffer, oc: Occlusion, castArr: Float32Array | null, M: LightModel | null, o: ShadeOpts): Uint8ClampedArray {
  const { W, Hh, vis, id, nx, ny, nz, th, tn, op, skn, skinCover, meta } = g, N = W * Hh, L = o.light ?? DEFAULT_LIGHT, pal = paletteOf(o.skin);
  const out = new Uint8ClampedArray(N * 4), aoK = o.ao ?? 0.55, grK = o.groove ?? 0.5;
  const sh = hex(pal.shadow), sk = hex(pal.skin), li = hex(pal.light);
  const alb = M ? mixc(sk, li, 0.38) : sk, T = M ? tonesOf(hexOf(alb), M) : null, rc = M ? parseHex(M.rimColor) : [0, 0, 0], lc = M ? parseHex(M.color) : [0, 0, 0];
  // Éclairage sans allocation par pixel : `shader` (invariants du modèle hoistés) écrit dans `so` ; `paintInto` écrit les trois canaux dans `rgb` (double précision, comme l'ancien tableau).
  const shader = M ? shaderOf(M) : null, so: ShadeOut = { lit: 0, core: 0, rim: 0, spec: 0 }, rgb = new Float64Array(3), rcN = [rc[0]! / 255, rc[1]! / 255, rc[2]! / 255], lcN = [lc[0]! / 255, lc[1]! / 255, lc[2]! / 255];
  const paintInto = (nxx: number, nyy: number, nzz: number, cs: number, occ1: number, add: number, gk: number): void => {
    shader!(nxx, nyy, nzz, cs, aoK * Math.min(1, occ1 / 10), 1, so);
    const lit = Math.min(1, Math.max(0, so.lit + add)) * gk, ra = Math.min(1, so.rim * 0.9), sa = Math.min(1, so.spec * 0.5);
    for (let ch = 0; ch < 3; ch++) { let m = T!.shadowMul[ch]! + (T!.lightMul[ch]! - T!.shadowMul[ch]!) * lit; m += (T!.coreMul[ch]! - m) * so.core; const v = alb[ch]! * m; rgb[ch] = v + (255 - v) * (ra * rcN[ch]! + sa * lcN[ch]!); }
  };
  for (let key = 0; key < N; key++) {
    const vi = id[key]!; if (vi < 0) continue;
    const md = meta[vi]!, occ = oc.occ[key]!, gro = oc.gro[key]!;
    const fib = md.fib ? 0.045 * Math.min(1, vis * 2) * Math.sin(th[key]! * 22) : 0, gk = 1 - grK * 0.45 * Math.min(1, gro / 4);
    let c0: number, c1: number, c2: number;
    if (M) { paintInto(nx[key]!, ny[key]!, nz[key]!, castArr![key]!, occ, 0.1 * tn[key]! + 2 * fib, gk); c0 = rgb[0]!; c1 = rgb[1]!; c2 = rgb[2]!; }
    else { // ancien éclairage (comparaisons avant/après) : seul cas où `tone` est utile
      let t = tone(p3(nx[key]!, ny[key]!, nz[key]!), L) + 0.14 * tn[key]! + fib;
      t *= 1 - aoK * Math.min(1, occ / 10) - grK * 0.45 * Math.min(1, gro / 4);
      const c = t < 0.55 ? mixc(sh, sk, Math.max(0, t) / 0.55) : mixc(sk, li, Math.min(1, (t - 0.55) / 0.6) * 0.62); c0 = c[0]!; c1 = c[1]!; c2 = c[2]!;
    }
    // Opacité de palier : un muscle PEU VISIBLE se fond sur la PEAU située dessous (couleur mêlée, alpha 1), il ne perce jamais le corps. Avant la correction de l'itération 05, l'opacité partait dans le canal alpha : le fond apparaissait à travers le ventre, les côtes et les bras (« creux » bleu-gris).
    const o1 = md.kind === 'skin' ? 1 : Math.min(1, op[key]! * 1.2), k4 = key * 4;
    if (o1 < 0.5 && !skinCover[key]) continue; // frange FAIBLE (< 50 %) d'un muscle dont le palier n'est pas atteint : fantôme hors de la peau, supprimé ; au-delà, le muscle reste visible (profil du pectoral)
    if (o1 < 1 && skinCover[key]) {
      const sx = skn[key * 3]!, sy = skn[key * 3 + 1]!, sz = skn[key * 3 + 2]!; let s0: number, s1: number, s2: number;
      if (M) { paintInto(sx, sy, sz, castArr![key]!, occ, 0, 1); s0 = rgb[0]!; s1 = rgb[1]!; s2 = rgb[2]!; }
      else { const ts = tone(p3(sx, sy, sz), L) * (1 - aoK * Math.min(1, occ / 10)), cs = ts < 0.55 ? mixc(sh, sk, Math.max(0, ts) / 0.55) : mixc(sk, li, Math.min(1, (ts - 0.55) / 0.6) * 0.62); s0 = cs[0]!; s1 = cs[1]!; s2 = cs[2]!; }
      out[k4] = s0 + (c0 - s0) * o1; out[k4 + 1] = s1 + (c1 - s1) * o1; out[k4 + 2] = s2 + (c2 - s2) * o1; out[k4 + 3] = 255;
    } else { out[k4] = c0; out[k4 + 1] = c1; out[k4 + 2] = c2; out[k4 + 3] = 255 * o1; }
  }
  return out;
}

/** Sur-échantillonnage → résolution finale (moyenne pondérée par la couverture), puis PNG incrusté dans le SVG. */
export function encodeFinal(g: GBuffer, out: Uint8ClampedArray): { svg: string; w: number; h: number; rgba: Uint8ClampedArray } {
  const { W, Hh, ss, x0, y0, x1, y1 } = g, w2 = Math.max(1, Math.floor(W / ss)), h2 = Math.max(1, Math.floor(Hh / ss)), fin = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let r = 0, gg = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const k = ((y * ss + j) * W + x * ss + i) * 4, al = out[k + 3]! / 255; r += out[k]! * al; gg += out[k + 1]! * al; b += out[k + 2]! * al; a += al; }
    const n2 = ss * ss, o4 = (y * w2 + x) * 4; if (a > 0) { fin[o4] = r / a; fin[o4 + 1] = gg / a; fin[o4 + 2] = b / a; fin[o4 + 3] = (a / n2) * 255; }
  }
  const png = encodePngRgba(w2, h2, fin), bw = x1 - x0, bh = y1 - y0;
  return { svg: `<g><image x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" preserveAspectRatio="none" href="data:image/png;base64,${png.toString('base64')}"/></g>`, w: w2, h: h2, rgba: fin };
}
