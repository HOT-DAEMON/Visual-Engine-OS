import type { HeadSpec } from './head';
import type { LockSpec } from './lock';
import { add, mul, norm, prng, v3, type V3 } from './vec';

/**
 * GRAMMAIRE DE COIFFURE : une coiffure = un CHAMP D'ÉCOULEMENT + des FAMILLES de mèches. Aucune coiffure n'a sa fonction :
 * les 12 coiffures de référence sont des jeux de paramètres (`profiles/*.ts`) interprétés par ce même générateur.
 *
 * Champ d'écoulement (au point de racine, repère de tête) : direction = somme pondérée de
 *   - `sweep`  : balayage global (vecteur de tête, ex. vers l'arrière ou vers le côté) ;
 *   - `swirl`  : rotation autour de l'axe de l'épi (`whorl`) — mèches qui tournent depuis le sommet ;
 *   - `radial` : écartement depuis l'épi (mèches qui retombent tout autour) ;
 *   - `fall`   : chute vers le bas (+y).
 * Une famille tire ses mèches dans une boîte (élévation × azimut) de la coque, avec des intervalles pour chaque grandeur :
 * longueur, courbure, ondulation, retroussé, décollement, largeur, ton. Le tirage est déterministe (graine).
 */
export interface Range { readonly lo: number; readonly hi: number }
const r = (lo: number, hi: number = lo): Range => ({ lo, hi });
export { r as range };

export interface FlowField {
  readonly whorl: V3;
  readonly sweep: V3;
  readonly swirl: number;
  readonly radial: number;
  readonly fall: number;
}

export interface FamilySpec {
  readonly id: string;
  readonly count: number;
  /** Boîte de racines sur la coque (degrés). */
  readonly el: Range; readonly az: Range;
  /** Poids de la direction locale du champ (1 = suit le champ) et direction imposée optionnelle ajoutée au champ. */
  readonly follow: number;
  readonly aim?: V3;
  /** Écart angulaire aléatoire du cap (rad, ±). */
  readonly fan: number;
  readonly length: Range; readonly bend: Range;
  readonly waveAmp: Range; readonly waveFreq: Range;
  readonly flickAmt: Range; readonly flickLen: Range;
  readonly lift0: Range; readonly lift1: Range; readonly liftPow: Range;
  readonly gravity: Range;
  readonly width: Range; readonly peak: Range; readonly taper: Range;
  readonly tone: Range; readonly strands: Range;
  readonly layer: LockSpec['layer'];
  /** Signe de la torsion (±1) : côté vers lequel se courbent les mèches (alterne par défaut). */
  readonly bendSign?: 1 | -1 | 0;
}

export interface HairProfile { readonly name: string; readonly head: HeadSpec; readonly field: FlowField; readonly families: readonly FamilySpec[] }

const pick = (g: () => number, a: Range): number => a.lo + (a.hi - a.lo) * g();

/** Direction du champ en un point de racine du repère de tête. */
export function fieldDir(F: FlowField, p: V3): V3 {
  const d = add(p, mul(F.whorl, -1));
  const radial = norm(d);
  const swirl = norm(v3(radial.z, 0, -radial.x)); // rotation autour de l'axe vertical de l'épi
  return norm(add(add(add(mul(F.sweep, 1), mul(swirl, F.swirl)), mul(radial, F.radial)), v3(0, F.fall, 0)));
}

/** Tire UNE mèche de la famille `F` (indice `i` : alternance du sens de courbure). Brique commune du générateur et de l'ajustement. */
export function sampleLock(P: HairProfile, F: FamilySpec, i: number, g: () => number): LockSpec {
  const H = P.head;
  const el = pick(g, F.el); const az = pick(g, F.az);
  const root = v3(H.rx * Math.cos((el * Math.PI) / 180) * Math.sin((az * Math.PI) / 180), -H.ry * Math.sin((el * Math.PI) / 180), H.cz + H.rz * Math.cos((el * Math.PI) / 180) * Math.cos((az * Math.PI) / 180));
  const fd = fieldDir(P.field, root);
  const base = F.aim ? add(mul(fd, F.follow), mul(norm(F.aim), 1 - F.follow + 0.0001)) : fd;
  // Écart de cap : rotation du vecteur autour de la verticale de la racine (rapide, suffisant pour l'éventail).
  const e = (g() * 2 - 1) * F.fan;
  const dir = v3(base.x * Math.cos(e) + base.z * Math.sin(e), base.y, -base.x * Math.sin(e) + base.z * Math.cos(e));
  const sign = F.bendSign === 0 ? 0 : (F.bendSign ?? (i % 2 === 0 ? 1 : -1));
  return {
    id: `${F.id}-${i}`, family: F.id, root: { el, az }, aim: norm(dir), length: pick(g, F.length),
    bend: sign * pick(g, F.bend), wave: { amp: pick(g, F.waveAmp) * (g() < 0.5 ? 1 : -1), freq: pick(g, F.waveFreq), phase: g() },
    flick: { amt: pick(g, F.flickAmt) * (g() < 0.5 ? 1 : -1), len: pick(g, F.flickLen) },
    lift0: pick(g, F.lift0), lift1: pick(g, F.lift1), liftPow: pick(g, F.liftPow), gravity: pick(g, F.gravity),
    width: pick(g, F.width), peak: pick(g, F.peak), taper: pick(g, F.taper), tone: pick(g, F.tone), strands: Math.round(pick(g, F.strands)), layer: F.layer,
  };
}

export function generate(P: HairProfile, seed = 1): LockSpec[] {
  const g = prng(seed);
  const out: LockSpec[] = [];
  for (const F of P.families) for (let i = 0; i < F.count; i++) out.push(sampleLock(P, F, i, g));
  return out;
}
