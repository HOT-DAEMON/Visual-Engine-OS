import type { NeckOperator } from '../schema/neck-system';
import type { NeckMorphology } from './types';
import type { Work } from './work';

/**
 * LES 12 OPÉRATEURS DU TODO §6. Chacun déclare : son DOMAINE (quels champs de `Work` il écrit), ses LIMITES (plage d'`amount` acceptée, le reste
 * est ramené et consigné), son ORDRE d'exécution canonique (la liste du schéma n'impose pas l'ordre : `stack.ts` trie) et ses INTERACTIONS (les
 * champs `compression`, `muscle`, `fold`, `ripple` qu'il écrit sont LUS par les opérateurs suivants et par le rendu : la géométrie RÉAGIT).
 * Les extrémités (haut sous la tête, base sur le thorax) sont protégées par `mask` : un opérateur déforme l'entre-deux, pas les raccords.
 */
export interface OperatorSpec {
  readonly op: NeckOperator['op'];
  readonly order: number;
  /** Plage d'`amount` acceptée. */
  readonly range: readonly [number, number];
  readonly domain: readonly string[];
  readonly reads: readonly string[];
  readonly run: (w: Work, o: NeckOperator, m: NeckMorphology) => void;
}

const smooth = (t: number): number => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/** Fenêtre gaussienne centrée en `at`, de largeur utile `span`. */
const win = (u: number, o: NeckOperator): number => Math.exp(-(((u - o.at) / (o.span / 2)) ** 2));
/** Masque des raccords : 0 aux extrémités (8 % de la longueur), 1 ailleurs. */
const mask = (u: number): number => smooth(u / 0.08) * smooth((1 - u) / 0.08);
const each = (w: Work, f: (i: number, u: number, g: number) => void, o: NeckOperator): void => { for (let i = 0; i <= w.N; i++) { const u = i / w.N; f(i, u, win(u, o) * mask(u)); } };
const sideL = (o: NeckOperator): number => (o.side <= 0 ? 1 : 0), sideR = (o: NeckOperator): number => (o.side >= 0 ? 1 : 0);

/** Redistribue les ordonnées : une région s'allonge (amount > 0) ou se raccourcit, le reste compense ; haut et base ne bougent pas. */
function lengthWarp(w: Work, o: NeckOperator, m: NeckMorphology): void {
  const s = new Float64Array(w.N + 1);
  for (let i = 0; i <= w.N; i++) s[i] = 1 + 0.6 * o.amount * win(i / w.N, o) * mask(i / w.N);
  let total = 0; for (let i = 1; i <= w.N; i++) total += (s[i]! + s[i - 1]!) / 2;
  let acc = 0; const y = Float64Array.from(w.y);
  for (let i = 1; i <= w.N; i++) { acc += (s[i]! + s[i - 1]!) / 2; w.y[i] = m.topY + (m.lengthPx * acc) / total; }
  // Une région raccourcie est comprimée : champ lu par `local_compression` / `fold_amplification` et par le rendu.
  for (let i = 0; i <= w.N; i++) { const dy = (w.y[i]! - y[i]!); if (o.amount < 0) w.fields.compression[i] = Math.min(1, w.fields.compression[i]! + Math.abs(dy) / (0.15 * m.lengthPx)); }
}

export const OPERATORS: readonly OperatorSpec[] = [
  { op: 'length_warp', order: 1, range: [-1, 1], domain: ['y', 'compression'], reads: [], run: lengthWarp },
  { op: 'centerline_bend', order: 2, range: [-1, 1], domain: ['x'], reads: [], run: (w, o, m) => each(w, (i, _u, g) => { w.x[i]! += o.amount * m.lengthPx * 0.22 * g; }, o) },
  { op: 'width_profile_warp', order: 3, range: [-1, 1], domain: ['aL', 'aR'], reads: [], run: (w, o) => each(w, (i, _u, g) => { w.aL[i]! *= 1 + 0.6 * o.amount * g; w.aR[i]! *= 1 + 0.6 * o.amount * g; }, o) },
  { op: 'depth_profile_warp', order: 4, range: [-1, 1], domain: ['bF', 'bB'], reads: [], run: (w, o) => each(w, (i, _u, g) => { w.bF[i]! *= 1 + 0.6 * o.amount * g; w.bB[i]! *= 1 + 0.6 * o.amount * g; }, o) },
  { op: 'local_bulge', order: 5, range: [-1, 1], domain: ['aL', 'aR', 'bF', 'bB'], reads: [], run: (w, o) => each(w, (i, _u, g) => { const k = 1 + 0.5 * o.amount * g; w.aL[i]! *= 1 + (k - 1) * sideL(o); w.aR[i]! *= 1 + (k - 1) * sideR(o); w.bF[i]! *= k; w.bB[i]! *= k; }, o) },
  { op: 'local_compression', order: 6, range: [0, 1], domain: ['aL', 'aR', 'bF', 'bB', 'compression'], reads: ['compression'], run: (w, o) => each(w, (i, _u, g) => { const k = 1 - 0.3 * o.amount * g; w.aL[i]! *= 1 + (k - 1) * sideL(o); w.aR[i]! *= 1 + (k - 1) * sideR(o); w.bF[i]! *= k; w.bB[i]! *= k; w.fields.compression[i] = Math.min(1, w.fields.compression[i]! + o.amount * g); }, o) },
  { op: 'asymmetric_deformation', order: 7, range: [-1, 1], domain: ['aL', 'aR', 'x'], reads: [], run: (w, o, m) => each(w, (i, _u, g) => { w.aL[i]! *= 1 - 0.4 * o.amount * g; w.aR[i]! *= 1 + 0.4 * o.amount * g; w.x[i]! += 0.15 * m.aTop * o.amount * g; }, o) },
  { op: 'topology_extension', order: 8, range: [0, 1], domain: ['aL', 'aR', 'bF', 'bB'], reads: [], run: (w, o) => each(w, (i, u, g) => { const k = Math.round(4 + o.amount * 8); const r = 1 - 0.09 * o.amount * g * (1 - Math.abs(2 * ((u * k) % 1) - 1)) ** 4; w.aL[i]! *= r; w.aR[i]! *= r; w.bF[i]! *= r; w.bB[i]! *= r; }, o) },
  { op: 'muscle_exaggeration', order: 9, range: [0, 1], domain: ['muscle', 'aL', 'aR'], reads: [], run: (w, o) => each(w, (i, _u, g) => { w.fields.muscle[i]! += o.amount * g; w.aL[i]! *= 1 + 0.12 * o.amount * g * sideL(o); w.aR[i]! *= 1 + 0.12 * o.amount * g * sideR(o); }, o) },
  { op: 'fold_amplification', order: 10, range: [0, 1], domain: ['fold'], reads: ['compression'], run: (w, o) => each(w, (i, _u, g) => { w.fields.fold[i]! *= 1 + 3 * o.amount * g * (1 + 2 * w.fields.compression[i]!); }, o) },
  { op: 'surface_ripple', order: 11, range: [0, 1], domain: ['ripple', 'aL', 'aR'], reads: [], run: (w, o, m) => each(w, (i, u, g) => { const r = o.amount * 0.06 * m.aTop * g * Math.sin(u * (10 + 14 * o.span) + 3 * (m.seed % 7)); w.fields.ripple[i]! += r; w.aL[i]! += r; w.aR[i]! += r; }, o) },
  // Dernier : clarifie la silhouette finale (lisse les largeurs, atténue ondulations et détails).
  { op: 'silhouette_simplification', order: 12, range: [0, 1], domain: ['aL', 'aR', 'bF', 'bB', 'simplify'], reads: ['ripple'], run: (w, o) => {
    w.fields.simplify = Math.max(w.fields.simplify, o.amount);
    for (const arr of [w.aL, w.aR, w.bF, w.bB]) { const c = Float64Array.from(arr); for (let i = 1; i < w.N; i++) arr[i] = c[i]! * (1 - 0.8 * o.amount) + 0.8 * o.amount * ((c[i - 1]! + c[i]! + c[i + 1]!) / 3); }
  } },
];

export const OPERATOR_BY_ID = new Map(OPERATORS.map((s) => [s.op, s]));
