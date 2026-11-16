import type { Lash } from './lashes';
import type { OpeningGeometry } from './opening';
import { cubicAt, type Vec } from './primitives';

/** Points échantillonnés le long d'un cil (cubique ou quadratique). */
export function lashSamples(l: Lash, n = 8): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (l.ctrl2) out.push(cubicAt(l.base, l.ctrl, l.ctrl2, l.tip, s));
    else { const u = 1 - s; out.push({ x: u * u * l.base.x + 2 * u * s * l.ctrl.x + s * s * l.tip.x, y: u * u * l.base.y + 2 * u * s * l.ctrl.y + s * s * l.tip.y }); }
  }
  return out;
}
/** Dépassement maximal des cils hors du cadre de l'ouverture, en fraction de la plus grande dimension de l'œil (contrat « zone du dessin » : verify/eye-lashes.ts `zoneFraction`). */
export function lashZoneExcess(g: OpeningGeometry, lashes: readonly Lash[]): number {
  const bb = g.bbox;
  const beyond = (p: Vec): number => Math.hypot(Math.max(bb.x - p.x, p.x - (bb.x + bb.w), 0), Math.max(bb.y - p.y, p.y - (bb.y + bb.h), 0));
  return Math.max(0, ...lashes.flatMap((l) => lashSamples(l).map(beyond))) / Math.max(g.w, g.h);
}

/** Dépassement maximal de points (pointe et bord de l'aile du liner) hors du cadre de l'ouverture, même unité que `lashZoneExcess`. */
export function pointsZoneExcess(g: OpeningGeometry, pts: readonly Vec[]): number {
  const bb = g.bbox;
  const beyond = (p: Vec): number => Math.hypot(Math.max(bb.x - p.x, p.x - (bb.x + bb.w), 0), Math.max(bb.y - p.y, p.y - (bb.y + bb.h), 0));
  return Math.max(0, ...pts.map(beyond)) / Math.max(g.w, g.h);
}
