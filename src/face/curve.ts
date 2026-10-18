import type { Vec } from '../geometry/eye/primitives';
import type { Poly } from './poly';

/**
 * Courbes utilitaires du moteur de visage (géométrie pure, sans SVG). Tout est déterministe : mêmes entrées, mêmes sommets.
 */

/** Interpolation linéaire. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Marche douce 0 → 1 (dérivée nulle aux deux bouts) : sert à enchaîner des largeurs sans cassure. */
export const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Rotation d'un vecteur de `deg` degrés (sens horaire en repère SVG, y vers le bas). */
export function rotate(v: Vec, deg: number): Vec {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * Courbe de Catmull-Rom (uniforme) passant par TOUS les points de contrôle : `n` sous-points par segment.
 * `closed` = boucle fermée (le dernier point se raccorde au premier). Les extrémités d'une courbe ouverte sont dupliquées.
 */
export function catmullRom(pts: readonly Vec[], closed: boolean, n = 8): Vec[] {
  const m = pts.length;
  if (m < 2) return [...pts];
  // Point voisin, avec bouclage (courbe fermée) ou recopie des extrémités (courbe ouverte).
  const at = (i: number): Vec => (closed ? (pts[((i % m) + m) % m] as Vec) : (pts[Math.min(m - 1, Math.max(0, i))] as Vec));
  const out: Vec[] = [];
  const segs = closed ? m : m - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      // Formule de Catmull-Rom : 0,5 × (2 p1 + (p2 − p0) t + (2 p0 − 5 p1 + 4 p2 − p3) t² + (3 p1 − p0 − 3 p2 + p3) t³).
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  if (!closed) out.push(pts[m - 1] as Vec);
  return out;
}

/** Super-ellipse (exposant `e` : 2 = ellipse, < 2 = losange arrondi, > 2 = rectangle arrondi), `n` sommets, centrée en (cx, cy). */
export function superEllipse(cx: number, cy: number, rx: number, ry: number, e: number, n = 32): Poly {
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // x = rx · sgn(cos) · |cos|^(2/e) ; y = ry · sgn(sin) · |sin|^(2/e)
    out.push({ x: cx + rx * Math.sign(c) * Math.abs(c) ** (2 / e), y: cy + ry * Math.sign(s) * Math.abs(s) ** (2 / e) });
  }
  return out;
}

/** Longueur d'une polyligne. */
export function polylineLength(p: readonly Vec[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot((p[i] as Vec).x - (p[i - 1] as Vec).x, (p[i] as Vec).y - (p[i - 1] as Vec).y);
  return l;
}

/** Miroir gauche/droite (x → -x) d'une polyligne ; l'ordre est inversé pour garder le sens de parcours d'un polygone. */
export const mirrorPoly = (p: readonly Vec[]): Poly => p.map((v) => ({ x: -v.x, y: v.y })).reverse();
