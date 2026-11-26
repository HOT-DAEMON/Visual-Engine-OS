import { toView, dirToView, fromView, dirFromView, FRONT } from './camera';
import { reliefAt } from './back-relief';
import { ringPoint } from './loft';
import { selectVolumes, type VRenderOpts } from './render';
import type { Volume, VolumeSet } from './types';
import { p3 } from './vec3';

/**
 * G-BUFFER du rendu par pixel : maillage des volumes → rasterisation (test de profondeur) → par pixel : profondeur, volume propriétaire, normale, θ de section, ton,
 * opacité de palier, normale de la peau dessous. NE DÉPEND NI DE LA LUMIÈRE NI DE LA PEAU NI DES RÉGLAGES D'OMBRAGE : changer la lumière ne le refait donc pas
 * (couche mise en cache par `pixel.ts`, docs/PERF-4.md). Extrait tel quel de l'ancien `renderVolumesPixel` : mêmes calculs, même ordre, mêmes résultats.
 */
export interface GBufferOpts extends Omit<VRenderOpts, 'skin' | 'light' | 'uid' | 'contact' | 'mode'> { readonly heightPx?: number; readonly ss?: number; /** Fondu des normales aux intersections peau/peau (itération 07, défaut : actif) ; `false` = ancien rendu. */ readonly seamBlend?: boolean; /** Relief du haut du dos (itération 08, défaut : actif) : normale de peau perturbée par le champ de `back-relief.ts` ; les volumes qu'il remplace (`RELIEF_REPLACES`) ne sont plus dessinés. `false` = ancien rendu. */ readonly backRelief?: boolean; /** Gain de la pente du champ (défaut 1 = pente physique) ; sert aux diagnostics. */ readonly reliefGain?: number }
/** Pente maximale (tangente) de la perturbation de normale : 0,6 ≈ 31°. */
export const RELIEF_SLOPE_MAX = 0.6;
/** Volumes du dos que le champ de relief remplace dans l'IMAGE (ils restent dans les données : repères, contrats, vérification). */
export const RELIEF_REPLACES = /^(trapezius\.(middle|lower)|rhomboid|infraspinatus|teres-major|scapular-spine|erector\.(medial|lateral))\.[LR]$/;
/** Mesure sur le G-buffer : pixels de peau fondus, plus grand saut de normale (degrés) entre deux pixels voisins de peaux différentes, avant et après le fondu. */
export interface SeamStats { readonly blended: number; readonly jumpBefore: number; readonly jumpAfter: number }
export interface VMeta { readonly layer: number; readonly tone: number; readonly fib: boolean; readonly kind: string; readonly rel: number; readonly mass: unknown }
export interface GBuffer {
  readonly W: number; readonly Hh: number; readonly ppu: number; readonly H: number; readonly vis: number; readonly ss: number;
  readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number;
  readonly depth: Float32Array; readonly id: Int16Array; readonly nx: Float32Array; readonly ny: Float32Array; readonly nz: Float32Array;
  readonly th: Float32Array; readonly tn: Float32Array; readonly op: Float32Array; readonly skn: Float32Array; readonly skinCover: Uint8Array;
  readonly meta: readonly VMeta[]; readonly ids: readonly string[]; readonly seam: SeamStats;
}
interface Tri { readonly x: number[]; readonly y: number[]; readonly z: number[]; readonly n: number[][]; readonly th: number[] }

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


/** Les options qui déterminent le G-buffer (clé de cache) : exactement celles que `selectVolumes`, le maillage et le cadrage lisent. */
export const gbufferKeyOf = (o: GBufferOpts): string => JSON.stringify([o.showHidden ?? null, o.camera ?? null, o.level ?? null, o.hideFromLayer ?? null, o.joints ?? null, o.trunkOnly ?? null, o.forceTier ?? null, o.quality ?? null, o.ss ?? null, o.heightPx ?? null, o.seamBlend !== false, o.backRelief ?? null, o.reliefGain ?? null]);

export function buildGBuffer(set: VolumeSet, o: GBufferOpts): GBuffer {
  const cam = o.camera ?? FRONT, H = set.measures.h as number, vis = set.measures.vis as number;
  const sel = selectVolumes(set, { ...o, skin: '' }), rel = sel.rel, useRelief = o.backRelief !== false && !!set.relief, list = useRelief ? sel.list.filter((v) => !RELIEF_REPLACES.test(v.id)) : sel.list, ss = o.ss ?? 2, K = o.quality === 'fast' ? 14 : 22, bias = 0.004 * H;
  const keyed = list.map((v) => { const m = mesh(v, cam, K); let zs = 0, n = 0; for (const t of m) for (const z of t.z) { zs += z; n++; } return { v, m, k: zs / Math.max(1, n) + v.layer * bias }; }).sort((a, b) => a.k - b.k);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { m } of keyed) for (const t of m) for (let i = 0; i < 3; i++) { x0 = Math.min(x0, t.x[i]!); x1 = Math.max(x1, t.x[i]!); y0 = Math.min(y0, t.y[i]!); y1 = Math.max(y1, t.y[i]!); }
  const mg = 0.04 * H; x0 -= mg; y0 -= mg; x1 += mg; y1 += mg;
  const ppu = ((o.heightPx ?? 900) * ss) / (y1 - y0);
  const W = Math.max(8, Math.ceil((x1 - x0) * ppu)), Hh = Math.max(8, Math.ceil((y1 - y0) * ppu)), N = W * Hh;
  // G-buffer
  const depth = new Float32Array(N).fill(-Infinity), id = new Int16Array(N).fill(-1), nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N), th = new Float32Array(N), tn = new Float32Array(N), op = new Float32Array(N);
  const sd = new Float32Array(N).fill(-Infinity), sn = new Float32Array(N * 3), st = new Float32Array(N);
  const skn = new Float32Array(N * 3), skinCover = new Uint8Array(N), isSkin = keyed.map(({ v }) => v.kind === 'skin'), isStrand = keyed.map(({ v }) => !!v.strand);
  const meta = keyed.map(({ v }) => ({ layer: v.layer, tone: v.tone, fib: v.kind === 'muscle' && v.fibres.length > 0, kind: v.kind, rel: rel(v), mass: v.mass }));
  // Rasterisation d'un volume dans le tampon de travail (test de profondeur) ; renvoie les pixels touchés.
  const so = new Int16Array(N), raster = (vi: number, touched: number[]): void => {
    for (const t of keyed[vi]!.m) {
      const ax = (t.x[0]! - x0) * ppu, ay = (t.y[0]! - y0) * ppu, bx = (t.x[1]! - x0) * ppu, by = (t.y[1]! - y0) * ppu, cx = (t.x[2]! - x0) * ppu, cy = (t.y[2]! - y0) * ppu;
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
      const mnx = Math.max(0, Math.floor(Math.min(ax, bx, cx))), mxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx))), mny = Math.max(0, Math.floor(Math.min(ay, by, cy))), mxy = Math.min(Hh - 1, Math.ceil(Math.max(ay, by, cy)));
      const z0 = t.z[0]!, z1 = t.z[1]!, z2 = t.z[2]!, th0 = t.th[0]!, th1 = t.th[1]!, th2 = t.th[2]!, na = t.n[0]!, nb = t.n[1]!, nc = t.n[2]!;
      for (let py = mny; py <= mxy; py++) for (let px = mnx; px <= mxx; px++) {
        const qx = px + 0.5, qy = py + 0.5, l0 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den, l1 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den, l2 = 1 - l0 - l1;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        const z = l0 * z0 + l1 * z1 + l2 * z2, key = py * W + px;
        if (sd[key]! >= z) continue;
        if (sd[key] === -Infinity) touched.push(key);
        sd[key] = z; so[key] = vi; st[key] = l0 * th0 + l1 * th1 + l2 * th2;
        sn[key * 3] = l0 * na[0]! + l1 * nb[0]! + l2 * nc[0]!; sn[key * 3 + 1] = l0 * na[1]! + l1 * nb[1]! + l2 * nc[1]!; sn[key * 3 + 2] = l0 * na[2]! + l1 * nb[2]! + l2 * nc[2]!;
      }
    }
  };
  // Recopie dans le G-buffer (le volume propriétaire de chaque pixel fournit ton, couche et opacité) et remise à zéro du tampon de travail.
  const commit = (touched: number[]): void => {
    for (const key of touched) {
      const vi = so[key]!, md = meta[vi]!;
      if ((isStrand[vi] && !skinCover[key]) || (!isSkin[vi] && skinZ[key]! > -Infinity && sd[key]! < skinZ[key]! - hideMargin)) { sd[key] = -Infinity; continue; }
      const a = sn[key * 3]!, b = sn[key * 3 + 1]!, c = sn[key * 3 + 2]!, len = Math.hypot(a, b, c) || 1;
      depth[key] = sd[key]!; id[key] = vi; nx[key] = a / len; ny[key] = b / len; nz[key] = c / len; th[key] = st[key]!; tn[key] = md.tone; op[key] = md.rel;
      sd[key] = -Infinity;
    }
  };
  // Passe PEAU : toutes les enveloppes partagent un tampon de profondeur (épaule, coude, cou se raccordent sans couture) ; puis les autres volumes en ordre du peintre.
  const skinKeys: number[] = [];
  keyed.forEach((_, vi) => { if (isSkin[vi]) raster(vi, skinKeys); });
  // FONDU DES NORMALES AUX INTERSECTIONS PEAU/PEAU (itération 07). Les enveloppes de peau partagent un tampon de profondeur : à l'intersection de deux surfaces (aine : bassin/cuisse ; épaule : tronc/bras) le pixel garde la normale de la surface la plus proche, d'où un liseré net (saut de normale de plusieurs dizaines de degrés). Les pixels situés à moins de `rb` d'un pixel de peau d'un AUTRE volume et de profondeur voisine (|Δz| < 1,5 % h : on ne floute jamais une silhouette) reçoivent la moyenne gaussienne des normales de la fenêtre : un congé, pas une arête.
  const seamStats = (keys: number[], blend: boolean): SeamStats => {
    const rb = Math.max(2, Math.round(0.024 * H * ppu)), dz = 0.015 * H, offs: [number, number][] = [];
    for (let j = -rb; j <= rb; j += Math.max(1, rb >> 2)) for (let i = -rb; i <= rb; i += Math.max(1, rb >> 2)) if (i * i + j * j <= rb * rb) offs.push([i, j]);
    const n0 = [Float32Array.from(nx), Float32Array.from(ny), Float32Array.from(nz)], marked: number[] = [];
    // Un RACCORD relie deux surfaces d'orientation voisine (≤ 75°, aine, épaule) ; au-delà (> 75°) c'est un CONTACT (aisselle, bras contre le flanc) : un pli réel, qu'on ne gomme pas.
    const same = (k: number, k2: number): boolean => id[k2]! >= 0 && isSkin[id[k2]!] === true && Math.abs(depth[k2]! - depth[k]!) < dz && n0[0]![k]! * n0[0]![k2]! + n0[1]![k]! * n0[1]![k2]! + n0[2]![k]! * n0[2]![k2]! > 0.26;
    const jump = (k: number, k2: number, n0: Float32Array[]): number => Math.acos(Math.max(-1, Math.min(1, n0[0]![k]! * n0[0]![k2]! + n0[1]![k]! * n0[1]![k2]! + n0[2]![k]! * n0[2]![k2]!))) * (180 / Math.PI);
    const pairs: number[] = [];
    for (const k of keys) {
      const px = k % W, py = (k / W) | 0; let seam = false;
      for (const [i, j] of [[rb, 0], [-rb, 0], [0, rb], [0, -rb], [rb * 0.7, rb * 0.7], [-rb * 0.7, rb * 0.7], [rb * 0.7, -rb * 0.7], [-rb * 0.7, -rb * 0.7]] as const) {
        const qx = Math.round(px + i), qy = Math.round(py + j); if (qx < 0 || qy < 0 || qx >= W || qy >= Hh) continue;
        const k2 = qy * W + qx; if (same(k, k2) && id[k2] !== id[k]) { seam = true; pairs.push(k, k2); }
      }
      if (seam) marked.push(k);
    }
    // Saut moyen (degrés) de la normale entre les paires de pixels voisins de deux peaux différentes : mesure du liseré, avant puis après le fondu.
    const meanJump = (nn: Float32Array[]): number => { let t = 0; for (let q = 0; q < pairs.length; q += 2) t += jump(pairs[q]!, pairs[q + 1]!, nn); return pairs.length ? t / (pairs.length / 2) : 0; };
    const jb = meanJump(n0);
    if (!blend) return { blended: 0, jumpBefore: jb, jumpAfter: jb };
    for (const k of marked) {
      const px = k % W, py = (k / W) | 0; let ax = 0, ay = 0, az = 0, wt = 0;
      for (const [i, j] of offs) {
        const qx = px + i, qy = py + j; if (qx < 0 || qy < 0 || qx >= W || qy >= Hh) continue;
        const k2 = qy * W + qx; if (!same(k, k2)) continue;
        const w = Math.exp(-(i * i + j * j) / (0.5 * rb * rb)); ax += n0[0]![k2]! * w; ay += n0[1]![k2]! * w; az += n0[2]![k2]! * w; wt += w;
      }
      const l = Math.hypot(ax, ay, az); if (wt > 0 && l > 1e-6) { nx[k] = ax / l; ny[k] = ay / l; nz[k] = az / l; }
    }
    return { blended: marked.length, jumpBefore: jb, jumpAfter: meanJump([nx, ny, nz]) };
  };
  commit(skinKeys); const seam = seamStats(skinKeys, o.seamBlend !== false);
  // RELIEF DU DOS (itération 08) : pour chaque pixel de la peau du tronc tourné vers l'arrière, on reconstruit le point monde depuis la profondeur, on lit la pente du champ de hauteur en (x, y)
  // et on incline la normale (silhouette et profondeur intactes). Poids : 0 de face/de profil, 1 quand la peau regarde franchement vers l'arrière. Fait ici (G-buffer) : indépendant de la lumière.
  if (useRelief) {
    const ti = keyed.findIndex(({ v }) => v.id === 'trunk'), G = o.reliefGain ?? 1, rf = set.relief!;
    if (ti >= 0) for (const key of skinKeys) {
      if (id[key] !== ti) continue;
      const nw = dirFromView(p3(nx[key]!, ny[key]!, nz[key]!), cam), wB = Math.min(1, Math.max(0, (-nw.z - 0.3) / 0.45)); if (wB <= 0) continue;
      const px = key % W, py = (key / W) | 0, w = fromView(p3(x0 + (px + 0.5) / ppu, y0 + (py + 0.5) / ppu, depth[key]!), cam), r = reliefAt(rf, w.x, w.y);
      const g0 = Math.hypot(r.hx, r.hy); if (g0 < 1e-6) continue;
      // Limiteur de pente (asymptote RELIEF_SLOPE_MAX ≈ 31°) : les crêtes étroites des sujets très musclés dépassaient 50° et dessinaient un liseré dur (saut de luminance max 83–89/255 contre 63–65 avant le relief) ; la direction du gradient est conservée.
      const lim = 1 / Math.sqrt(1 + (g0 / RELIEF_SLOPE_MAX) ** 2); r.hx *= lim; r.hy *= lim;
      const t = dirToView(p3(nw.x - wB * r.hx * G, nw.y - wB * r.hy * G, nw.z), cam), l = Math.hypot(t.x, t.y, t.z) || 1;
      nx[key] = t.x / l; ny[key] = t.y / l; nz[key] = t.z / l;
      // Modelé de ton : le relief éclaircit ce qui avance et assombrit les gouttières (lisible quelle que soit la direction de la lumière) ; borné à ±0,7 et pondéré comme la normale.
      tn[key] = tn[key]! + wB * Math.max(-0.7, Math.min(0.7, (r.h / (0.05 * H)) * 0.9));
    }
  }
  for (const key of skinKeys) { skinCover[key] = 1; skn[key * 3] = nx[key]!; skn[key * 3 + 1] = ny[key]!; skn[key * 3 + 2] = nz[key]!; }
  // Les volumes profonds situés DERRIÈRE la surface de la peau (dos vu de face…) sont masqués ; les muscles sous la peau, à moins d'une demi-épaisseur, restent visibles.
  const skinZ = Float32Array.from(depth), hideMargin = 0.05 * H;
  keyed.forEach((_, vi) => { if (isSkin[vi]) return; const t: number[] = []; raster(vi, t); commit(t); });
  return { W, Hh, ppu, H, vis, ss, x0, y0, x1, y1, depth, id, nx, ny, nz, th, tn, op, skn, skinCover, meta, ids: keyed.map((k) => k.v.id), seam };
}
