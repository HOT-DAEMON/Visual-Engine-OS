import { sectionAt, type HeadSpec } from './head';
import { add, clamp, cross, dot, mul, norm, smooth, sub, v3, type V3 } from './vec';

/**
 * COQUE CAPILLAIRE : surface sur laquelle les mèches sont posées. Elle suit le crâne et la mâchoire (`sectionAt`) puis se
 * prolonge en cylindre de cou sous le menton (pour les mèches qui pendent derrière l'oreille jusqu'à la nuque).
 * Paramétrage (y, azimut) ; au sommet du crâne l'azimut est dégénéré (la demi-largeur tend vers 0), d'où le plancher `A_MIN`.
 */
const A_MIN = 0.02;
const NECK = { a: 0.2, zc: -0.12, b: 0.18 };
/** Raccord mâchoire → cou : de Y_JOIN à Y_JOIN + SPAN (ordonnées de tête, unités H). */
const Y_JOIN = 0.32;
const SPAN = 0.3;

/**
 * Raccord C¹ : un Hermite cubique qui REPREND la pente de la mâchoire à Y_JOIN et s'aplatit sur le cylindre de cou.
 * L'ancien raccord (`smooth`, dérivée nulle au départ) cassait la pente de la coque d'environ 46° à y = 0,32 (da/dy −1,34 → −0,12, mesuré) :
 * un coude CONCAVE, où la courbe décalée de `lift` × normale se replie sur elle-même (queue d'aronde). Toute mèche longue qui franchissait la mâchoire
 * y faisait un saut 3D de 150–176° puis une boucle de pointe dans l'image (7 `geom.self` sur 77 mèches, résidus à 30°, 60° et −75°).
 * Garde-fou testé : écart au raccord précédent ≤ 0,03 sur toute la zone, pentes égales de part et d'autre de Y_JOIN (tests/hair-engine-shell.test.ts).
 */
const hermite = (p0: number, m0: number, p1: number, t: number): number => {
  const t2 = t * t; const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 * SPAN + (-2 * t3 + 3 * t2) * p1;
};

function shellSection(h: HeadSpec, y: number): { a: number; zc: number; b: number } {
  if (y <= Y_JOIN) { const s = sectionAt(h, Math.max(-h.ry + 1e-3, y)); return { a: Math.max(A_MIN, s.a), zc: s.zc, b: Math.max(A_MIN, s.b) }; }
  const s0 = sectionAt(h, Y_JOIN); const e = 1e-3; const s1 = sectionAt(h, Y_JOIN - e); const t = clamp((y - Y_JOIN) / SPAN, 0, 1);
  const f = (k: 'a' | 'zc' | 'b'): number => hermite(s0[k], (s0[k] - s1[k]) / e, NECK[k], t);
  return { a: Math.max(A_MIN, f('a')), zc: f('zc'), b: Math.max(A_MIN, f('b')) };
}

/** Point de la coque (ordonnée y, azimut radian : 0 = face, +π/2 = côté +x). */
export function shellPoint(h: HeadSpec, y: number, az: number): V3 {
  const s = shellSection(h, y);
  return v3(s.a * Math.sin(az), y, s.zc + s.b * Math.cos(az));
}

/** Coordonnées (y, azimut) d'un point 3D quelconque, par projection sur la coque. */
export function toShell(h: HeadSpec, p: V3): { y: number; az: number } {
  const y = clamp(p.y, -h.ry + 1e-3, 0.95);
  const s = shellSection(h, y);
  return { y, az: Math.atan2(p.x / s.a, (p.z - s.zc) / s.b) };
}

/** Normale sortante de la coque en (y, az) : produit vectoriel des tangentes, orientée vers l'extérieur. */
export function shellNormal(h: HeadSpec, y: number, az: number): V3 {
  const e = 1e-3;
  const dAz = sub(shellPoint(h, y, az + e), shellPoint(h, y, az - e));
  const dY = sub(shellPoint(h, y + e, az), shellPoint(h, y - e, az));
  let n = norm(cross(dAz, dY));
  const p = shellPoint(h, y, az);
  const s = shellSection(h, y);
  const out = v3(p.x, y < -h.ry * 0.9 ? -1 : 0, p.z - s.zc);
  if (dot(n, out) < 0) n = mul(n, -1);
  return n;
}

/** Tangente « vers le bas » et « vers +azimut » en (y, az), normalisées. */
export function shellTangents(h: HeadSpec, y: number, az: number): { down: V3; around: V3 } {
  const e = 1e-3;
  return {
    down: norm(sub(shellPoint(h, y + e, az), shellPoint(h, y - e, az))),
    around: norm(sub(shellPoint(h, y, az + e), shellPoint(h, y, az - e))),
  };
}

/** Ordonnée sous laquelle la coque est lisse (crâne ellipsoïdal) : la normale de décollement y est la normale exacte. */
const FREE_Y = 0.08;
/** Longueur sur laquelle la normale de décollement passe progressivement de la normale exacte à la normale lissée. */
const FREE_BLEND = 0.08;
const TAPS: readonly (readonly [number, number])[] = [[-1, 1], [-0.5, 2], [0, 3], [0.5, 2], [1, 1]];

/**
 * Normale de DÉCOLLEMENT : celle selon laquelle on écarte une mèche de `off` de la coque. Une mèche qui se tient à distance `off` de la peau ne suit pas
 * les détails de la peau plus petits que `off` : la normale est donc moyennée (triangle à 5 points) sur une fenêtre de ± `off` le long de la coque.
 * Sans cela, la courbe décalée `coque + off·n` se replie là où la coque a un coude concave (mesuré : `sectionAt` casse sa pente en y = 0,2, la mâchoire :
 * normale n.y 0,37 → 0,00 → 0,37 sur trois échantillons, saut 3D de 137° et 141°). Avec la fenêtre, le virage de la normale par unité de longueur est borné
 * par Δθ/(2·off) : off · |dn/ds| ≤ Δθ/2 < 1 pour tout coude de moins de 114°, la courbe décalée ne peut plus se replier.
 * Inchangée au sommet et sur les côtés du crâne (y < 0,08) et pour une mèche plaquée (off < 0,02) : seules les mèches qui franchissent la mâchoire sont touchées.
 */
export function offsetNormal(h: HeadSpec, y: number, az: number, off: number, exact?: V3): V3 {
  const n0 = exact ?? shellNormal(h, y, az); const w = Math.abs(off);
  const k = smooth((y - FREE_Y) / FREE_BLEND);
  if (w < 0.02 || k <= 0) return n0;
  let s = v3(0, 0, 0); let tot = 0;
  for (const [d, wt] of TAPS) { s = add(s, mul(shellNormal(h, clamp(y + d * w, -h.ry + 1e-3, 0.95), az), wt)); tot += wt; }
  return norm(add(mul(n0, 1 - k), mul(norm(mul(s, 1 / tot)), k)));
}

export const onShell = (h: HeadSpec, y: number, az: number, off: number): V3 => add(shellPoint(h, y, az), mul(offsetNormal(h, y, az, off), off));
