import { encodePngRgba } from '../../core/png';
import { toView, dirToView, FRONT } from './camera';
import { ringPoint } from './loft';
import { selectVolumes, type VMarkup, type VRenderOpts } from './render';
import { DEFAULT_LIGHT, tone, paletteOf } from './shade';
import { p3 } from './vec3';
import type { Volume, VolumeSet } from './types';

/**
 * RENDU PAR PIXEL des volumes : même géométrie, même sélection et même ordre de peinture que le rendu vectoriel, mais l'ombrage est calculé À
 * CHAQUE PIXEL depuis la normale interpolée (au lieu d'un dégradé par volume). Pipeline : G-buffer (normale, profondeur, identifiant, θ de
 * section) → éclairage global `tone` → occlusion ambiante par horizon sur la profondeur → rainures de séparation entre volumes → stries de
 * fibres → sur-échantillonnage (`ss`) → PNG incrusté dans le SVG (le moteur reste un moteur SVG affichable dans le navigateur).
 */
export interface PixelOpts extends VRenderOpts { readonly heightPx?: number; readonly ss?: number; readonly ao?: number; readonly groove?: number }
interface Tri { readonly x: number[]; readonly y: number[]; readonly z: number[]; readonly n: number[][]; readonly th: number[] }
const hex = (c: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(c); const v = m ? parseInt(m[1] as string, 16) : 0xc99a76; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mixc = (a: number[], b: number[], t: number): number[] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/** Maillage d'un volume en vue : (stations − 1) × K quadrilatères, deux triangles chacun, normales de section interpolées. */
function mesh(v: Volume, cam: NonNullable<VRenderOpts['camera']>, K: number): Tri[] {
  // Couvercles : sauf peau (enveloppes continues entre elles) et brins, chaque bout est refermé par une calotte (4 anneaux, profil circulaire).
  let st = v.stations;
  if (v.kind !== 'skin' && !v.strand && st.length > 1) {
    const cap = (s: Volume['stations'][number], sg: 1 | -1): Volume['stations'][number][] => [0.55, 0.83, 0.97].map((u) => { const r = Math.sqrt(Math.max(0, 1 - u * u)), d = Math.max(s.a, s.b) * 0.6 * u * sg; return { ...s, c: { x: s.c.x + s.t.x * d, y: s.c.y + s.t.y * d, z: s.c.z + s.t.z * d }, a: Math.max(1e-3, s.a * r), b: Math.max(1e-3, s.b * r) }; });
    st = [...cap(st[0]!, -1).reverse(), ...st, ...cap(st[st.length - 1]!, 1)];
  }
  const rings = st.map((s) => Array.from({ length: K + 1 }, (_, k) => { const th = (k / K) * 2 * Math.PI, q = ringPoint(s, th), pv = toView(q.p, cam), nv = dirToView(q.n, cam); return { x: pv.x, y: pv.y, z: pv.z, n: [nv.x, nv.y, nv.z], th }; }));
  const out: Tri[] = [];
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < K; k++) {
    const a = rings[i]![k]!, b = rings[i]![k + 1]!, c = rings[i + 1]![k]!, d = rings[i + 1]![k + 1]!;
    for (const t of [[a, b, c], [b, d, c]] as const) out.push({ x: t.map((q) => q.x), y: t.map((q) => q.y), z: t.map((q) => q.z), n: t.map((q) => q.n), th: t.map((q) => q.th) });
  }
  return out;
}

/** Rendu pixel d'un VolumeSet → SVG (image PNG incrustée). Pur et déterministe. */
export interface VPixelMarkup extends VMarkup { readonly pixels: { readonly w: number; readonly h: number; readonly rgba: Uint8ClampedArray } }
export function renderVolumesPixel(set: VolumeSet, o: PixelOpts): VPixelMarkup {
  const cam = o.camera ?? FRONT, L = o.light ?? DEFAULT_LIGHT, pal = paletteOf(o.skin), H = set.measures.h as number, vis = set.measures.vis as number;
  const { list, rel } = selectVolumes(set, o), ss = o.ss ?? 2, K = o.quality === 'fast' ? 14 : 22, bias = 0.004 * H;
  const keyed = list.map((v) => { const m = mesh(v, cam, K); let zs = 0, n = 0; for (const t of m) for (const z of t.z) { zs += z; n++; } return { v, m, k: zs / Math.max(1, n) + v.layer * bias }; }).sort((a, b) => a.k - b.k);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { m } of keyed) for (const t of m) for (let i = 0; i < 3; i++) { x0 = Math.min(x0, t.x[i]!); x1 = Math.max(x1, t.x[i]!); y0 = Math.min(y0, t.y[i]!); y1 = Math.max(y1, t.y[i]!); }
  const mg = 0.04 * H; x0 -= mg; y0 -= mg; x1 += mg; y1 += mg;
  const ppu = ((o.heightPx ?? 900) * ss) / (y1 - y0);
  const W = Math.max(8, Math.ceil((x1 - x0) * ppu)), Hh = Math.max(8, Math.ceil((y1 - y0) * ppu)), N = W * Hh;
  // G-buffer
  const depth = new Float32Array(N).fill(-Infinity), id = new Int16Array(N).fill(-1), nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N), th = new Float32Array(N), tn = new Float32Array(N), ly = new Uint8Array(N), op = new Float32Array(N);
  const sd = new Float32Array(N).fill(-Infinity), sn = new Float32Array(N * 3), st = new Float32Array(N);
  const skinCover = new Uint8Array(N), isSkin = keyed.map(({ v }) => v.kind === 'skin'), isStrand = keyed.map(({ v }) => !!v.strand);
  const meta = keyed.map(({ v }) => ({ layer: v.layer, tone: v.tone, fib: v.kind === 'muscle' && v.fibres.length > 0, kind: v.kind, rel: rel(v) }));
  // Rasterisation d'un volume dans le tampon de travail (test de profondeur) ; renvoie les pixels touchés.
  const so = new Int16Array(N), raster = (vi: number, touched: number[]): void => {
    for (const t of keyed[vi]!.m) {
      const ax = (t.x[0]! - x0) * ppu, ay = (t.y[0]! - y0) * ppu, bx = (t.x[1]! - x0) * ppu, by = (t.y[1]! - y0) * ppu, cx = (t.x[2]! - x0) * ppu, cy = (t.y[2]! - y0) * ppu;
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
      const mnx = Math.max(0, Math.floor(Math.min(ax, bx, cx))), mxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx))), mny = Math.max(0, Math.floor(Math.min(ay, by, cy))), mxy = Math.min(Hh - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let py = mny; py <= mxy; py++) for (let px = mnx; px <= mxx; px++) {
        const qx = px + 0.5, qy = py + 0.5, l0 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den, l1 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den, l2 = 1 - l0 - l1;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        const z = l0 * t.z[0]! + l1 * t.z[1]! + l2 * t.z[2]!, key = py * W + px;
        if (sd[key]! >= z) continue;
        if (sd[key] === -Infinity) touched.push(key);
        sd[key] = z; so[key] = vi; st[key] = l0 * t.th[0]! + l1 * t.th[1]! + l2 * t.th[2]!;
        for (let j = 0; j < 3; j++) sn[key * 3 + j] = l0 * t.n[0]![j]! + l1 * t.n[1]![j]! + l2 * t.n[2]![j]!;
      }
    }
  };
  // Recopie dans le G-buffer (le volume propriétaire de chaque pixel fournit ton, couche et opacité) et remise à zéro du tampon de travail.
  const commit = (touched: number[]): void => {
    for (const key of touched) {
      const vi = so[key]!, md = meta[vi]!;
      if ((isStrand[vi] && !skinCover[key]) || (!isSkin[vi] && skinZ[key]! > -Infinity && sd[key]! < skinZ[key]! - hideMargin)) { sd[key] = -Infinity; continue; }
      const a = sn[key * 3]!, b = sn[key * 3 + 1]!, c = sn[key * 3 + 2]!, len = Math.hypot(a, b, c) || 1;
      depth[key] = sd[key]!; id[key] = vi; nx[key] = a / len; ny[key] = b / len; nz[key] = c / len; th[key] = st[key]!; tn[key] = md.tone; ly[key] = md.layer; op[key] = md.rel;
      sd[key] = -Infinity;
    }
  };
  // Passe PEAU : toutes les enveloppes partagent un tampon de profondeur (épaule, coude, cou se raccordent sans couture) ; puis les autres volumes en ordre du peintre.
  const skinKeys: number[] = [];
  keyed.forEach((_, vi) => { if (isSkin[vi]) raster(vi, skinKeys); });
  commit(skinKeys); for (const key of skinKeys) skinCover[key] = 1;
  // Les volumes profonds situés DERRIÈRE la surface de la peau (dos vu de face…) sont masqués ; les muscles sous la peau, à moins d'une demi-épaisseur, restent visibles.
  const skinZ = Float32Array.from(depth), hideMargin = 0.05 * H;
  keyed.forEach((_, vi) => { if (isSkin[vi]) return; const t: number[] = []; raster(vi, t); commit(t); });
  // Éclairage par pixel, occlusion ambiante (horizon sur la profondeur) et rainures de séparation.
  const out = new Uint8ClampedArray(N * 4), aoK = o.ao ?? 0.55, grK = o.groove ?? 0.5, R = Math.max(2, Math.round(0.018 * H * ppu)), DIR = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const;
  const sh = hex(pal.shadow), sk = hex(pal.skin), li = hex(pal.light), rg = new Float32Array(N);
  for (let key = 0; key < N; key++) {
    const vi = id[key]!; if (vi < 0) continue;
    const px = key % W, py = (key / W) | 0, z = depth[key]!, md = meta[vi]!;
    // AO : voisins plus proches du spectateur que ce pixel (relief qui l'abrite) ; rainure : voisin d'un autre volume situé AU-DESSUS (couche supérieure).
    let occ = 0, gro = 0;
    for (const [dx, dy] of DIR) for (const r of [R * 0.5, R]) {
      const qx = Math.round(px + dx * r), qy = Math.round(py + dy * r); if (qx < 0 || qy < 0 || qx >= W || qy >= Hh) continue;
      const k2 = qy * W + qx, v2 = id[k2]!; if (v2 < 0) continue;
      occ += Math.min(1, Math.max(0, (depth[k2]! - z - 0.002 * H) / (0.05 * H)));
      if (v2 !== vi && meta[v2]!.layer > md.layer && r === R * 0.5) gro += 1;
    }
    const nv = p3(nx[key]!, ny[key]!, nz[key]!), fib = md.fib ? 0.045 * Math.min(1, vis * 2) * Math.sin(th[key]! * 22) : 0;
    let t = tone(nv, L) + 0.14 * tn[key]! + fib;
    t *= 1 - aoK * Math.min(1, occ / 10) - grK * 0.45 * Math.min(1, gro / 4);
    const c = t < 0.55 ? mixc(sh, sk, Math.max(0, t) / 0.55) : mixc(sk, li, Math.min(1, (t - 0.55) / 0.6) * 0.62);
    rg[key] = t;
    out.set([c[0]!, c[1]!, c[2]!, 255 * Math.min(1, md.kind === 'skin' ? 1 : op[key]! * 1.2 + 0.0)], key * 4);
  }
  // Sur-échantillonnage → résolution finale (moyenne pondérée par la couverture).
  const w2 = Math.max(1, Math.floor(W / ss)), h2 = Math.max(1, Math.floor(Hh / ss)), fin = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const k = ((y * ss + j) * W + x * ss + i) * 4, al = out[k + 3]! / 255; r += out[k]! * al; g += out[k + 1]! * al; b += out[k + 2]! * al; a += al; }
    const n2 = ss * ss, o4 = (y * w2 + x) * 4; if (a > 0) { fin[o4] = r / a; fin[o4 + 1] = g / a; fin[o4 + 2] = b / a; fin[o4 + 3] = (a / n2) * 255; }
  }
  const png = encodePngRgba(w2, h2, fin), bw = x1 - x0, bh = y1 - y0;
  const svg = `<g><image x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" preserveAspectRatio="none" href="data:image/png;base64,${png.toString('base64')}"/></g>`;
  void rg;
  return { svg, bounds: { x0, y0, x1, y1 }, drawn: keyed.length, ids: keyed.map((k) => k.v.id), pixels: { w: w2, h: h2, rgba: fin } };
}
