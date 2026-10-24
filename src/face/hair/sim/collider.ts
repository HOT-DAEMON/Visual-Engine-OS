import { clamp } from '../../../core/math';
import type { FaceLandmarks } from '../../landmarks';
import { halfWidthAt, rightSamples } from '../../outline';

/** Point 3D du repère de l'hôte : x droite, y bas, z vers la caméra (+z = devant le visage). */
export interface P3 { x: number; y: number; z: number }

/**
 * Corps de collision : crâne (ellipsoïde au-dessus du plus large), visage (sections elliptiques dont la demi-largeur est lue sur
 * le VRAI contour), cou (cylindre) et épaules (évasement sous la base du cou). `pad` = épaisseur de la chevelure.
 */
export interface Collider {
  readonly topY: number;
  readonly yWide: number;
  readonly pad: number;
  /** Demi-largeur du corps (tête / cou / épaules) à l'ordonnée y, SANS l'épaisseur des cheveux. */
  half(y: number): number;
  /** Demi-profondeur (axe z) à y. */
  depth(y: number): number;
  /** Repousse un point hors du corps (épaisseur `pad` incluse). Retourne le point corrigé et vrai s'il y a eu contact. */
  push(p: P3): { p: P3; hit: boolean };
  /** Point de la surface (offset `pad`) à la hauteur y et à l'azimut az (0 = face, ±π/2 = côtés, π = nuque). */
  surface(y: number, az: number): P3;
  /** Rapproche un point de la surface (offset `pad`) pour que la distance radiale reste ≤ `reach` : enveloppe de volume des cheveux. */
  shell(p: P3, reach: number): P3;
  /** Profondeur z de la surface (face avant) à (x, y) ; 0 hors du corps. */
  frontZ(x: number, y: number): number;
  /** Ordonnée de la ligne d'épaule au pied du cou. */
  readonly shoulderY: number;
}

export function makeCollider(lm: FaceLandmarks, pad: number): Collider {
  const { H, outline } = lm;
  const samples = rightSamples(outline);
  const topY = -H / 2;
  const hw = (y: number): number => halfWidthAt(outline, clamp(y, topY + 0.02 * H, lm.chinY - 0.002 * H), samples);
  // Plus large : balayage du contour (le crâne est un ellipsoïde au-dessus, une pile de sections en dessous).
  let yWide = topY + 0.3 * H;
  let wMax = 0;
  for (let i = 0; i <= 40; i++) {
    const y = topY + (0.7 * H * i) / 40;
    const w = hw(y);
    if (w > wMax) { wMax = w; yWide = y; }
  }
  const k = 0.95;
  const neckHalf = lm.neck.half;
  const shoulderY = lm.neck.bottomY;
  const shoulderMax = Math.max(wMax * 1.5, neckHalf * 3.2);
  const half = (y: number): number => {
    if (y <= lm.chinY) return hw(y);
    // Sous le menton : raccord lisse du menton vers le cou, puis cou, puis évasement des épaules.
    const t = clamp((y - lm.chinY) / (0.06 * H), 0, 1);
    const neck = hw(lm.chinY) + (neckHalf - hw(lm.chinY)) * t * t * (3 - 2 * t);
    if (y <= shoulderY) return neck;
    const s = clamp((y - shoulderY) / (0.16 * H), 0, 1);
    return neckHalf + (shoulderMax - neckHalf) * (1 - (1 - s) ** 2);
  };
  const depth = (y: number): number => Math.max(k * half(y), 0.35 * neckHalf);
  const a0 = wMax + pad;
  const b0 = yWide - topY + pad;
  const c0 = k * wMax + pad;
  const push = (p: P3): { p: P3; hit: boolean } => {
    if (p.y < yWide) {
      // Calotte : ellipsoïde gonflé de `pad`, projection radiale (conserve l'azimut).
      const dy = p.y - yWide;
      const s = (p.x / a0) ** 2 + (dy / b0) ** 2 + (p.z / c0) ** 2;
      if (s >= 1) return { p, hit: false };
      const f = 1 / Math.sqrt(Math.max(s, 1e-6));
      return { p: { x: p.x * f, y: yWide + dy * f, z: p.z * f }, hit: true };
    }
    const hx = half(p.y) + pad;
    const hz = depth(p.y) + pad;
    const s = (p.x / hx) ** 2 + (p.z / hz) ** 2;
    if (s >= 1) return { p, hit: false };
    const f = 1 / Math.sqrt(Math.max(s, 1e-6));
    return { p: { x: p.x * f, y: p.y, z: p.z * f }, hit: true };
  };
  const surface = (y: number, az: number): P3 => {
    if (y < yWide) {
      const u = clamp((y - yWide) / b0, -1, 1);
      const r = Math.sqrt(1 - u * u);
      return { x: a0 * r * Math.sin(az), y, z: c0 * r * Math.cos(az) };
    }
    return { x: (half(y) + pad) * Math.sin(az), y, z: (depth(y) + pad) * Math.cos(az) };
  };
  const shell = (p: P3, reach: number): P3 => {
    const cy = p.y < yWide ? yWide : p.y;
    const hx = p.y < yWide ? a0 : half(p.y) + pad;
    const hz = p.y < yWide ? c0 : depth(p.y) + pad;
    const hy = p.y < yWide ? b0 : 1e9;
    const s = Math.sqrt((p.x / hx) ** 2 + ((p.y - cy) / hy) ** 2 + (p.z / hz) ** 2);
    const limit = 1 + reach / Math.max(hx, 1);
    if (s <= limit) return p;
    const f = limit / s;
    return { x: p.x * f, y: cy + (p.y - cy) * f, z: p.z * f };
  };
  const frontZ = (x: number, y: number): number => {
    if (y < yWide) return c0 * Math.sqrt(Math.max(0, 1 - (x / a0) ** 2 - ((y - yWide) / b0) ** 2));
    return (depth(y) + pad) * Math.sqrt(Math.max(0, 1 - (x / (half(y) + pad)) ** 2));
  };
  return { topY, yWide, pad, half, depth, push, surface, shell, frontZ, shoulderY };
}
