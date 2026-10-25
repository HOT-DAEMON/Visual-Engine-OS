/**
 * Bruit de Perlin « feTurbulence » — implémentation de RÉFÉRENCE de la spécification SVG 1.1 (§15.22), en TypeScript pur.
 *
 * Pourquoi : `feTurbulence` est recalculé par le rastériseur à CHAQUE rendu, pixel par pixel, sur toute la région du filtre
 * (≈ 30 % du temps de rastérisation d'un visage, mesuré dans docs/PERF-2.md). Or son résultat ne dépend que de
 * (fréquence, graine, octaves, canal) : on le calcule UNE fois, sur une petite tuile périodique (`stitchTiles`), et le SVG
 * l'embarque comme image répétée (`feImage` + `feTile`) — voir `tile.ts`.
 *
 * Contrat : fonction PURE et déterministe (aucun `Math.random`, aucun état partagé entre appels) ; mêmes arguments → mêmes
 * valeurs, sur tout moteur JS. Entiers 32 bits comme la spec (le générateur de Park–Miller reste < 2^31).
 */
const RAND_M = 2147483647;
const RAND_A = 16807;
const RAND_Q = 127773;
const RAND_R = 2836;
const B_SIZE = 0x100;
const BM = 0xff;
const PERLIN_N = 0x1000;

/** Générateur congruentiel de la spec (Park–Miller). */
const rnd = (seed: number): number => {
  const r = RAND_A * (seed % RAND_Q) - RAND_R * Math.trunc(seed / RAND_Q);
  return r <= 0 ? r + RAND_M : r;
};
const setupSeed = (s: number): number => {
  let v = s;
  if (v <= 0) v = -(v % (RAND_M - 1)) + 1;
  if (v > RAND_M - 1) v = RAND_M - 1;
  return v;
};

interface Lattice { readonly sel: Int32Array; readonly grad: Float64Array /* [canal][i][2] */ }

/** Table de permutation + gradients unitaires (4 canaux), initialisés depuis la graine (spec : `init`). */
function initLattice(seedIn: number): Lattice {
  const sel = new Int32Array(B_SIZE + B_SIZE + 2);
  const grad = new Float64Array(4 * (B_SIZE + B_SIZE + 2) * 2);
  const g = (k: number, i: number, j: number): number => ((k * (B_SIZE + B_SIZE + 2) + i) * 2) + j;
  let seed = setupSeed(Math.trunc(seedIn));
  let i = 0;
  for (let k = 0; k < 4; k++) {
    for (i = 0; i < B_SIZE; i++) {
      sel[i] = i;
      for (let j = 0; j < 2; j++) { seed = rnd(seed); grad[g(k, i, j)] = ((seed % (B_SIZE + B_SIZE)) - B_SIZE) / B_SIZE; }
      const s = Math.hypot(grad[g(k, i, 0)] as number, grad[g(k, i, 1)] as number);
      grad[g(k, i, 0)] = (grad[g(k, i, 0)] as number) / s;
      grad[g(k, i, 1)] = (grad[g(k, i, 1)] as number) / s;
    }
  }
  while (--i) {
    const k = sel[i] as number;
    seed = rnd(seed);
    const j = seed % B_SIZE;
    sel[i] = sel[j] as number;
    sel[j] = k;
  }
  for (let n = 0; n < B_SIZE + 2; n++) {
    sel[B_SIZE + n] = sel[n] as number;
    for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) grad[g(k, B_SIZE + n, j)] = grad[g(k, n, j)] as number;
  }
  return { sel, grad };
}

interface Stitch { w: number; h: number; wrapX: number; wrapY: number }
const sCurve = (t: number): number => t * t * (3 - 2 * t);
const lerp = (t: number, a: number, b: number): number => a + t * (b - a);

function noise2(L: Lattice, ch: number, vx: number, vy: number, st: Stitch | null): number {
  let t = vx + PERLIN_N;
  let bx0 = Math.trunc(t) & BM; let bx1 = (bx0 + 1) & BM;
  const rx0 = t - Math.trunc(t); const rx1 = rx0 - 1;
  t = vy + PERLIN_N;
  let by0 = Math.trunc(t) & BM; let by1 = (by0 + 1) & BM;
  const ry0 = t - Math.trunc(t); const ry1 = ry0 - 1;
  if (st) { // raccord périodique : les points de maille au-delà de la limite reviennent au début de la tuile
    if (bx0 >= st.wrapX) bx0 -= st.w;
    if (bx1 >= st.wrapX) bx1 -= st.w;
    if (by0 >= st.wrapY) by0 -= st.h;
    if (by1 >= st.wrapY) by1 -= st.h;
  }
  bx0 &= BM; bx1 &= BM; by0 &= BM; by1 &= BM;
  const sel = L.sel;
  const i = sel[bx0] as number; const j = sel[bx1] as number;
  const b00 = sel[i + by0] as number; const b10 = sel[j + by0] as number;
  const b01 = sel[i + by1] as number; const b11 = sel[j + by1] as number;
  const sx = sCurve(rx0); const sy = sCurve(ry0);
  const base = ch * (B_SIZE + B_SIZE + 2);
  const q = (b: number, k: number): number => L.grad[(base + b) * 2 + k] as number;
  const u0 = rx0 * q(b00, 0) + ry0 * q(b00, 1);
  const v0 = rx1 * q(b10, 0) + ry0 * q(b10, 1);
  const a = lerp(sx, u0, v0);
  const u1 = rx0 * q(b01, 0) + ry1 * q(b01, 1);
  const v1 = rx1 * q(b11, 0) + ry1 * q(b11, 1);
  return lerp(sy, a, lerp(sx, u1, v1));
}

export interface TurbulenceParams {
  readonly freqX: number;
  readonly freqY: number;
  readonly octaves: number;
  readonly seed: number;
  /** Largeur/hauteur de la tuile périodique, en pixels. */
  readonly size: number;
}

/**
 * Somme fractale (`fractalNoise`) du canal `ch` (0 R, 1 V, 2 B, 3 A) sur une tuile `size × size` PÉRIODIQUE.
 * Valeur brute dans ≈ [−1, 1] (moyenne ≈ 0). La fréquence est ajustée à l'entier de mailles le plus proche (règle de la spec),
 * ce qui rend la tuile raccordable sans couture. Retourne `size²` valeurs, ligne par ligne.
 */
export function fractalTile(p: TurbulenceParams, ch = 3): Float64Array {
  const L = initLattice(p.seed);
  const adj = (f: number): number => {
    if (f === 0) return 0;
    const lo = Math.floor(p.size * f) / p.size; const hi = Math.ceil(p.size * f) / p.size;
    return lo > 0 && f / lo < hi / f ? lo : hi;
  };
  const fx = adj(p.freqX); const fy = adj(p.freqY);
  const out = new Float64Array(p.size * p.size);
  for (let y = 0; y < p.size; y++) {
    for (let x = 0; x < p.size; x++) {
      const st: Stitch = { w: Math.trunc(p.size * fx + 0.5), h: Math.trunc(p.size * fy + 0.5), wrapX: 0, wrapY: 0 };
      st.wrapX = Math.trunc(0 * fx + PERLIN_N + st.w);
      st.wrapY = Math.trunc(0 * fy + PERLIN_N + st.h);
      let vx = x * fx; let vy = y * fy; let ratio = 1; let sum = 0;
      for (let o = 0; o < p.octaves; o++) {
        sum += noise2(L, ch, vx, vy, st) / ratio;
        vx *= 2; vy *= 2; ratio *= 2;
        st.w *= 2; st.wrapX = 2 * st.wrapX - PERLIN_N; st.h *= 2; st.wrapY = 2 * st.wrapY - PERLIN_N;
      }
      out[y * p.size + x] = sum;
    }
  }
  return out;
}
