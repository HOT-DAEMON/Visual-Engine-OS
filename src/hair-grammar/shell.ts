import { sectionAt, type HeadSpec } from './head';
import { add, clamp, cross, dot, lerp, mul, norm, smooth, sub, v3, type V3 } from './vec';

/**
 * COQUE CAPILLAIRE : surface sur laquelle les mèches sont posées. Elle suit le crâne et la mâchoire (`sectionAt`) puis se
 * prolonge en cylindre de cou sous le menton (pour les mèches qui pendent derrière l'oreille jusqu'à la nuque).
 * Paramétrage (y, azimut) ; au sommet du crâne l'azimut est dégénéré (la demi-largeur tend vers 0), d'où le plancher `A_MIN`.
 */
const A_MIN = 0.02;
const NECK = { a: 0.2, zc: -0.12, b: 0.18 };

function shellSection(h: HeadSpec, y: number): { a: number; zc: number; b: number } {
  if (y <= 0.32) { const s = sectionAt(h, Math.max(-h.ry + 1e-3, y)); return { a: Math.max(A_MIN, s.a), zc: s.zc, b: Math.max(A_MIN, s.b) }; }
  const s0 = sectionAt(h, 0.32);
  const t = smooth((y - 0.32) / 0.3);
  return { a: lerp(s0.a, NECK.a, t), zc: lerp(s0.zc, NECK.zc, t), b: lerp(s0.b, NECK.b, t) };
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

export const onShell = (h: HeadSpec, y: number, az: number, off: number): V3 => add(shellPoint(h, y, az), mul(shellNormal(h, y, az), off));
