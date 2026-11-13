import { cubicAt, type Vec } from './primitives';
import type { OpeningGeometry } from './opening';

/** Nombre d'échantillons du profil (x = 0 canthus interne … 1 canthus externe, pas de 1/20). */
export const PROFILE_SAMPLES = 21;

/** Descripteurs de l'enveloppe, dans le REPÈRE DES CANTHI (axe interne -> externe), unités = largeur ; mêmes grandeurs que `scripts/eye-refs/extract.py`. */
export interface OpeningProfile {
  /** Angle de l'axe des canthi (° ; > 0 : externe plus haut, comme `shape.tiltDeg`). */
  readonly tiltDeg: number;
  /** (hauteur haute + hauteur basse) / largeur. */
  readonly aspect: number;
  readonly upperFraction: number;
  /** Position (0..1 le long de l'axe) du sommet de la paupière haute et du creux de la basse. */
  readonly upperPeakAt: number;
  readonly lowerPeakAt: number;
  /** Hauteur de chaque paupière au-dessus / au-dessous de l'axe, `PROFILE_SAMPLES` points. */
  readonly upper: readonly number[];
  readonly lower: readonly number[];
  /** Angle d'ouverture (°) entre les deux paupières près de chaque canthus. */
  readonly canthusAngleDeg: { readonly inner: number; readonly outer: number };
}

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;

export function openingProfile(g: OpeningGeometry): OpeningProfile {
  const N = 256;
  const up: Vec[] = Array.from({ length: N + 1 }, (_, i) => cubicAt(g.pi, g.u1, g.u2, g.po, i / N));
  const lo: Vec[] = Array.from({ length: N + 1 }, (_, i) => cubicAt(g.po, g.l1, g.l2, g.pi, i / N));
  const ang = Math.atan2(g.po.y - g.pi.y, g.po.x - g.pi.x);
  const ca = Math.cos(-ang);
  const sa = Math.sin(-ang);
  const W = Math.hypot(g.po.x - g.pi.x, g.po.y - g.pi.y) || 1;
  const rot = (p: Vec): Vec => ({ x: ((p.x - g.pi.x) * ca - (p.y - g.pi.y) * sa) / W, y: ((p.x - g.pi.x) * sa + (p.y - g.pi.y) * ca) / W });
  const U = up.map(rot);
  const D = lo.map(rot);
  const at = (P: readonly Vec[], x: number): number => {
    let best = P[0] as Vec;
    for (const p of P) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best.y;
  };
  const xs = Array.from({ length: PROFILE_SAMPLES }, (_, i) => i / (PROFILE_SAMPLES - 1));
  const upper = xs.map((x) => -at(U, x));
  const lower = xs.map((x) => at(D, x));
  const iu = upper.indexOf(Math.max(...upper));
  const il = lower.indexOf(Math.max(...lower));
  const hUp = Math.max(...U.map((p) => -p.y));
  const hLo = Math.max(...D.map((p) => p.y));
  const cant = (a: Vec, b: Vec, c: Vec): number => Math.abs((Math.atan2((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y)) * 180) / Math.PI);
  const k = Math.round(N / 16);
  const inner = cant(U[0] as Vec, U[k] as Vec, D[N - k] as Vec);
  const outer = cant(U[N] as Vec, U[N - k] as Vec, D[k] as Vec);
  return {
    tiltDeg: r4((-ang * 180) / Math.PI),
    aspect: r4(hUp + hLo),
    upperFraction: r4(hUp / (hUp + hLo || 1)),
    upperPeakAt: r4(xs[iu] as number),
    lowerPeakAt: r4(xs[il] as number),
    upper: upper.map(r4),
    lower: lower.map(r4),
    canthusAngleDeg: { inner: r4(inner), outer: r4(outer) },
  };
}
