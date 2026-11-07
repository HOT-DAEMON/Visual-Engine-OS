import { mulberry32 } from '../core/prng';
import type { DeformFields, HeadContext, NeckMorphology, Station } from './types';

/**
 * GÉOMÉTRIE PRIMAIRE (GEO-01) : volume reliant la tête au thorax = centre-ligne + sections. `Work` est l'état MUTABLE que traversent les
 * opérateurs de déformation (TODO §6) puis les mouvements (§4) ; `toStations` le fige. Les extrémités sont ANCRÉES (haut sous la tête,
 * base sur l'ancre du corps) : un opérateur déforme l'entre-deux, jamais les raccords (test « changement de longueur : ancrages intacts »).
 */
export interface Work {
  readonly N: number;
  readonly x: Float64Array; readonly y: Float64Array; readonly z: Float64Array;
  readonly aL: Float64Array; readonly aR: Float64Array; readonly bF: Float64Array; readonly bB: Float64Array;
  readonly n: Float64Array; readonly twist: Float64Array;
  readonly fields: { compression: Float64Array; muscle: Float64Array; ripple: Float64Array; fold: Float64Array; compressionSide: Float64Array; muscleSide: Float64Array; simplify: number };
}

const smooth = (t: number): number => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
export const stationCount = (m: NeckMorphology): number => Math.max(32, m.segments * 8 + 1);

/** Bruit 1D déterministe, lisse, dans [−1, 1] (valeur à 7 nœuds, interpolation douce). Même graine ⇒ même cou. */
function noise1(seed: number, salt: number): (u: number) => number {
  const r = mulberry32((seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0);
  const k = Array.from({ length: 7 }, () => r() * 2 - 1);
  return (u) => { const f = Math.min(5.9999, Math.max(0, u * 6)); const i = Math.floor(f); return k[i]! + (k[i + 1]! - k[i]!) * smooth(f - i); };
}

export function baseWork(m: NeckMorphology, ctx: HeadContext): Work {
  const N = stationCount(m) - 1;
  const mk = (): Float64Array => new Float64Array(N + 1);
  const w: Work = { N, x: mk(), y: mk(), z: mk(), aL: mk(), aR: mk(), bF: mk(), bB: mk(), n: mk(), twist: mk(), fields: { compression: mk(), muscle: mk(), ripple: mk(), fold: new Float64Array(N + 1).fill(1), compressionSide: mk(), muscleSide: mk(), simplify: 0 } };
  const L = m.lengthPx, rad = Math.PI / 180;
  const nL = noise1(m.seed, 1), nR = noise1(m.seed, 2), nF = noise1(m.seed, 3), nB = noise1(m.seed, 4);
  // Le haut du cou reste SOUS la tête : décalage latéral borné (voir `topShift`), jamais au-delà du demi-menton.
  const lean = L * Math.sin(m.rollDeg * rad) * 0.35, fwd = L * Math.sin(m.pitchDeg * rad) * 0.35;
  for (let i = 0; i <= N; i++) {
    const u = i / N, d = 1 - u;
    // Pente nuque → épaule : exposant 2^(1−2·trapèze) (0,5 → 1 = lissage historique ; 1 → 0,5 pente vive et bombée ; 0 → 2 pente lente).
    const fp = smooth((u - m.flareStart) / (1 - m.flareStart)) ** 2 ** (1 - 2 * m.trapezius);
    const waist = 1 - 0.38 * m.waist * Math.exp(-(((u - 0.62) / 0.16) ** 2));
    const taper = 1 + 0.45 * m.taper * u;
    // Anneaux : en dessous de ± 7 % de pincement aux jonctions de segments (cou segmenté, serpentin, cuirassé).
    const ring = m.segments > 1 ? 1 - 0.07 * (1 - Math.abs(2 * ((u * m.segments) % 1) - 1)) ** 4 : 1;
    const a = (m.aTop + (m.aBase - m.aTop) * fp) * taper * waist * ring * (1 + 0.12 * (m.trapezius - 0.5) * fp);
    const b = m.bTop * (1 + ((m.aBase / m.aTop) - 1) * 0.5 * fp) * (1 + 0.27 * m.taper * u) * waist * ring;
    // Le cou reste DERRIÈRE la tête : au-dessus de la mâchoire sa largeur est plafonnée au contour (0,9 ×) ; sous la mâchoire elle retrouve sa valeur sur 12 % de la
    // longueur (un cou plus large que la mâchoire — taureau — émerge donc en s'évasant, sans bord horizontal visible à côté de la joue).
    const yy = m.topY + L * u, jawU = Math.min(0.95, Math.max(0.02, (ctx.jawY - m.topY) / L));
    const cap = (yy < ctx.jawY ? ctx.headHalfTop + (ctx.headHalfJaw - ctx.headHalfTop) * smooth((yy - m.topY) / (ctx.jawY - m.topY || 1)) : ctx.headHalfJaw + (a - ctx.headHalfJaw) * smooth((u - jawU) / 0.12)) * (yy < ctx.jawY ? 0.9 : 1);
    const hide = Math.min(1, cap / Math.max(a, 1e-6));
    w.y[i] = yy;
    w.x[i] = m.axisOffsetPx + lean * d ** 1.5;
    w.z[i] = fwd * d ** 1.5 + L * (0.18 * m.curvature * Math.sin(Math.PI * u) + 0.22 * m.sCurve * Math.sin(2 * Math.PI * u));
    w.aL[i] = a * hide * (1 - 0.25 * m.lrBias) * (1 + 0.1 * m.variation * nL(u));
    w.aR[i] = a * hide * (1 + 0.25 * m.lrBias) * (1 + 0.1 * m.variation * nR(u));
    w.bF[i] = b * hide * (1 + 0.25 * m.fbBias) * (1 + 0.1 * m.variation * nF(u));
    w.bB[i] = b * hide * (1 - 0.25 * m.fbBias) * (1 + 0.1 * m.variation * nB(u));
    w.n[i] = m.sectionExp;
    w.twist[i] = m.torsionDeg * rad * d;
  }
  return w;
}

export function toStations(w: Work, m: NeckMorphology): Station[] {
  const out: Station[] = [];
  for (let i = 0; i <= w.N; i++) out.push({ u: i / w.N, x: w.x[i]!, y: w.y[i]!, z: w.z[i]!, aL: w.aL[i]!, aR: w.aR[i]!, bF: w.bF[i]!, bB: w.bB[i]!, n: w.n[i]!, twist: w.twist[i]!, seg: Math.min(m.segments - 1, Math.floor((i / w.N) * m.segments)) });
  return out;
}

export const freezeFields = (w: Work): DeformFields => w.fields;
