/**
 * RÉGION DES CHEVEUX sur la surface de la tête : polygone dans le plan déroulé (azimut en degrés, hauteur y en U). Contrairement à la
 * lisière à une seule valeur y(azimut) de `hairlineY`, un polygone sait représenter la POCHE de peau entre l'implantation et la patte
 * (la lisière revient vers la face avant de redescendre le long de la patte) : c'est la forme exacte de la lisière du moteur de visage.
 */
export type RegionPoint = readonly [number, number];
export type HairRegion = readonly RegionPoint[];

/** Vrai si (az, y) est dans la région (règle pair-impair). L'azimut est pris tel quel : la région est définie sur (−180°, 180°]. */
export function inRegion(poly: HairRegion, az: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, yi] = poly[i]!, [aj, yj] = poly[j]!;
    if (yi > y !== yj > y && az < ((aj - ai) * (y - yi)) / (yj - yi) + ai) inside = !inside;
  }
  return inside;
}

/** U de surface par degré d'azimut (≈ π/180 × rayon moyen du crâne) : passe l'azimut en longueur pour mesurer des distances. */
export const U_PER_DEG = 0.006;

/** Distance (U, sur la surface déroulée) de (az, y) aux arêtes RÉELLES de la lisière : les arêtes artificielles (sur le sommet, y = 0, et sur le raccord ±180°) sont ignorées. */
export function edgeDistance(poly: HairRegion, az: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    if ((a[1] <= 0 && b[1] <= 0) || (Math.abs(a[0]) >= 180 && Math.abs(b[0]) >= 180 && Math.sign(a[0]) === Math.sign(b[0]))) continue;
    const ax = a[0] * U_PER_DEG, bx = b[0] * U_PER_DEG, px = az * U_PER_DEG;
    const dx = bx - ax, dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (y - a[1]) * dy) / l2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), y - (a[1] + t * dy)));
  }
  return best;
}

/** Lisière à une valeur y(azimut) tirée de la région : première sortie de la région en descendant depuis le sommet (azimuts 0°, 10°… 180°). */
export function regionKnots(poly: HairRegion, step = 10, dy = 0.004, yMax = 1.0): readonly (readonly [number, number])[] {
  const out: [number, number][] = [];
  for (let az = 0; az <= 180; az += step) {
    let y = 0.02;
    const a = Math.min(az, 179.5);
    while (y < yMax && inRegion(poly, a, y)) y += dy;
    out.push([az, Math.min(y, yMax)]);
  }
  return out;
}

/** Champ de distance SIGNÉ (U ; > 0 dans la région) échantillonné sur une grille azimut × hauteur et mémoïsé par région : un pixel coûte une interpolation, pas un parcours de toutes les arêtes. */
export interface RegionField { readonly d: Float32Array; readonly nA: number; readonly nY: number; readonly dA: number; readonly dY: number; readonly yMax: number }
const FIELDS = new WeakMap<object, RegionField>();

export function regionField(poly: HairRegion, dA = 0.5, dY = 0.004, yMax = 1.1): RegionField {
  const hit = FIELDS.get(poly);
  if (hit) return hit;
  const nA = Math.round(360 / dA) + 1, nY = Math.round(yMax / dY) + 1, BIG = 0.05, d = new Float32Array(nA * nY).fill(-BIG);
  // 1. Signe : remplissage par lignes de balayage (pair-impair), O(lignes × arêtes) au lieu d'un test de point par cellule.
  for (let j = 0; j < nY; j++) {
    const y = j * dY, xs: number[] = [];
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const [ai, yi] = poly[i]!, [ak, yk] = poly[k]!;
      if (yi > y !== yk > y) xs.push(((ak - ai) * (y - yi)) / (yk - yi) + ai);
    }
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) for (let c = Math.max(0, Math.ceil((xs[m]! + 180) / dA)); c < nA && -180 + c * dA < xs[m + 1]!; c++) d[j * nA + c] = BIG;
  }
  // 2. Distance : exacte dans une bande de ±3 cellules autour de chaque arête réelle, saturée à ±BIG ailleurs (seule la bande sert : trait de lisière).
  const near = new Set<number>();
  for (let e = 0; e < poly.length; e++) {
    const a = poly[e]!, b = poly[(e + 1) % poly.length]!;
    if ((a[1] <= 0 && b[1] <= 0) || (Math.abs(a[0]) >= 180 && Math.abs(b[0]) >= 180 && Math.sign(a[0]) === Math.sign(b[0]))) continue;
    const n = Math.max(2, Math.ceil(Math.max(Math.abs(b[0] - a[0]) / dA, Math.abs(b[1] - a[1]) / dY)));
    for (let q = 0; q <= n; q++) {
      const ci = Math.round((a[0] + ((b[0] - a[0]) * q) / n + 180) / dA), cj = Math.round((a[1] + ((b[1] - a[1]) * q) / n) / dY);
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && i < nA && j >= 0 && j < nY) near.add(j * nA + i); }
    }
  }
  for (const k of near) { const j = Math.floor(k / nA), i = k - j * nA, e = Math.min(BIG, edgeDistance(poly, -180 + i * dA, j * dY)); d[k] = d[k]! > 0 ? e : -e; }
  const f = { d, nA, nY, dA, dY, yMax };
  FIELDS.set(poly, f);
  return f;
}

/** Distance signée (U) en (az, y) : interpolation bilinéaire du champ ; hors grille, la valeur du bord. */
export function signedDistance(f: RegionField, az: number, y: number): number {
  const u = Math.min(f.nA - 1.001, Math.max(0, (az + 180) / f.dA)), v = Math.min(f.nY - 1.001, Math.max(0, y / f.dY));
  const i = Math.floor(u), j = Math.floor(v), s = u - i, t = v - j, k = j * f.nA + i;
  return (f.d[k]! * (1 - s) + f.d[k + 1]! * s) * (1 - t) + (f.d[k + f.nA]! * (1 - s) + f.d[k + f.nA + 1]! * s) * t;
}

/** Arrondit les angles de la lisière (coupe-coin de Chaikin, `n` passes) en gardant les points artificiels du sommet et du raccord : la région garde sa topologie, les marches deviennent des courbes. */
export function smoothRegion(poly: HairRegion, n = 2): HairRegion {
  let P = poly.slice();
  for (let pass = 0; pass < n; pass++) {
    const out: RegionPoint[] = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i]!, b = P[(i + 1) % P.length]!;
      const fix = (q: RegionPoint): boolean => q[1] <= 0 || Math.abs(q[0]) >= 180;
      if (fix(a) || fix(b)) { out.push(a); continue; }
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    P = out;
  }
  return P;
}
