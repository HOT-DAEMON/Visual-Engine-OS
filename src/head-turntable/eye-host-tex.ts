import { clamp, smooth } from './math';
import { hex, mix } from './color';
import { LID_SHADOW, WHITE } from './eye-colors';
import { distPolyline, inPoly } from './engines/face-parts';
import { REGION, type HostEye, type HostEyes, type V3 } from './types';
import type { Pal, Tex } from './face-tex';

/** Données dérivées d'un œil d'hôte, calculées UNE fois (le peintre les lit à chaque pixel du visage) : contour fermé, boîte, demi-largeur, canthus externe. */
interface Prep { readonly outline: { x: number; y: number }[]; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly cx: number; readonly hw: number; readonly outer: { x: number; y: number } }
const PREP = new WeakMap<HostEye, Prep>();
function prep(e: HostEye): Prep {
  let r = PREP.get(e);
  if (!r) {
    const outline = [...e.upper, ...[...e.lower].reverse()], xs = outline.map((q) => q.x), ys = outline.map((q) => q.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    PREP.set(e, (r = { outline, x0, x1, y0: Math.min(...ys), y1: Math.max(...ys), cx: (x0 + x1) / 2, hw: (x1 - x0) / 2, outer: e.upper[e.upper.length - 1]! }));
  }
  return r;
}

const upperY = (e: HostEye, x: number): number => { let b = e.upper[0]!, d = Infinity; for (const q of e.upper) { const dd = Math.abs(q.x - x); if (dd < d) { d = dd; b = q; } } return b.y; };
const dseg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const vx = bx - ax, vy = by - ay, t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};

/**
 * Œil de l'HÔTE peint sur la surface du visage (coordonnées tête, orthographique le long de z : à 0° le tracé se superpose à l'œil du dessin de face).
 * Forme = ouverture réelle (paupières supérieure et inférieure du moteur d'œil), taille = celle de l'hôte, regard = décalage réel de l'iris dans l'ouverture (l'iris est recoupé par la paupière).
 * Mêmes conventions de style que l'œil de la planche : trait de paupière épais en haut, filet en bas, cil de bout, deux reflets, bague sombre de l'iris.
 */
export function eyeTexHost(E: HostEyes, p: V3, k: number, pal: Pal): Tex | null {
  const e = p.x >= 0 ? E.right : E.left, g = prep(e), x = Math.abs(p.x), y = p.y;
  if (x < g.x0 - 0.05 || x > g.x1 + 0.08 || y < g.y0 - 0.08 || y > g.y1 + 0.05) return null;
  const ink: Tex = { c: pal.ink, region: REGION.eye, ink: true }, s = g.hw / 0.085;
  // Cil de bout : part du canthus externe, vers l'extérieur et le haut (mêmes proportions que la planche, ramenées à la taille de l'œil).
  if (dseg(x, y, g.outer.x - 0.1 * g.hw, g.outer.y - 0.01 * s, g.outer.x + 0.3 * g.hw, g.outer.y - 0.034 * s) < 0.0045 * k) return ink;
  const inside = inPoly(g.outline, x, y), au = clamp((x - g.cx) / g.hw, -1, 1);
  const dUp = distPolyline(e.upper, x, y), th = 0.0115 * k * (0.7 + 0.5 * Math.pow(Math.max(0, 1 - au * au), 0.5));
  if (dUp < th * 0.6 || (dUp < th && !inside && y < upperY(e, x))) return ink;
  if (Math.abs(au) < 0.95 && distPolyline(e.lower, x, y) < 0.0035 * k) return ink;
  if (!inside) return null;
  const { iris: ir, pupil: pu } = e, dx = x - ir.cx, dy = y - ir.cy, rr = Math.hypot(dx / ir.rx, dy / ir.ry), R = ir.rx;
  if (rr < 1) {
    if (Math.hypot(dx + 0.29 * R, dy + 0.42 * R) < 0.26 * R) return { c: WHITE, region: REGION.eye };
    const light = mix(pal.iris, WHITE, 0.42);   // reflet d'iris : l'iris de l'hôte éclairci (la planche, bleue, avait un bleu clair fixe)
    if (Math.hypot(dx - 0.34 * R, dy - 0.35 * R) < 0.11 * R) return { c: mix(light, WHITE, 0.7), region: REGION.eye };
    if (pu.contours.some((c) => inPoly(c as { x: number; y: number }[], dx, dy))) return { c: hex(pu.color), region: REGION.eye };
    if (rr > 0.8) return { c: pal.deep, region: REGION.eye };
    return { c: mix(pal.iris, light, smooth((dy / ir.ry) * 1.2) * 0.8), region: REGION.eye };
  }
  return { c: y < upperY(e, x) + 0.022 ? LID_SHADOW : WHITE, region: REGION.eye };
}
