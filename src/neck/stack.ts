import { Resolver } from '../core/resolve';
import type { NeckOperator, NeckSystem } from '../schema/neck-system';
import { OPERATOR_BY_ID } from './operators';
import type { AppliedOperator, NeckDeformationStack, NeckMorphology } from './types';
import type { Work } from './work';

/**
 * PILE DE DÉFORMATIONS (TODO §6). Trois règles :
 *  1. ORDRE : les opérateurs s'exécutent dans l'ordre CANONIQUE (`OperatorSpec.order`), pas dans celui de la liste ; à ordre égal, l'ordre de la liste.
 *     Longueur → axe → largeur → profondeur → bosses → compression → asymétrie → topologie → muscles → plis → ondulation → simplification.
 *  2. LIMITES : un `amount` hors de la plage de l'opérateur est ramené et consigné (`clamped`).
 *  3. GARDE-FOUS après la pile : pas d'inversion de surface (demi-largeur / profondeur ≥ plancher), pas d'étirement incontrôlé (écart entre
 *     stations dans [0,2 ; 3]× l'écart nominal), ordonnées croissantes. Toute correction est consignée. L'espèce `fantasy` relâche ces garde-fous :
 *     c'est le SEUL cas où l'inversion/l'étirement extrême est permis, et il est explicite.
 */
export function applyStack(w: Work, ops: readonly NeckOperator[], m: NeckMorphology, species: NeckSystem['species']): NeckDeformationStack {
  const R = new Resolver();
  const applied: AppliedOperator[] = [];
  const ordered = ops.map((o, idx) => ({ o, idx, spec: OPERATOR_BY_ID.get(o.op)! })).sort((p, q) => p.spec.order - q.spec.order || p.idx - q.idx);
  for (const { o, idx, spec } of ordered) {
    const amount = R.limit(`operator-range-${o.op}`, `neck.system.operators[${idx}].amount`, o.amount, spec.range[0], spec.range[1], `plage de ${o.op} : [${spec.range[0]}, ${spec.range[1]}]`);
    spec.run(w, { ...o, amount }, m);
    applied.push({ op: o.op, amount, at: o.at, span: o.span, side: o.side, order: spec.order, clamped: amount !== o.amount });
  }
  guard(w, m, species, R);
  return { applied, corrections: R.applied };
}

function guard(w: Work, m: NeckMorphology, species: NeckSystem['species'], R: Resolver): void {
  const free = species === 'fantasy';
  const floorW = (free ? 0.1 : 0.3) * m.aTop, floorD = (free ? 0.1 : 0.3) * m.bTop;
  const nominal = m.lengthPx / w.N, lo = (free ? 0.05 : 0.2) * nominal, hi = (free ? 6 : 3) * nominal;
  // Écarts entre stations : bornés, puis renormalisés pour que la base reste sur l'ancre du corps.
  const dy = new Float64Array(w.N);
  let worst = 1, fixed = false;
  for (let i = 0; i < w.N; i++) {
    const d = w.y[i + 1]! - w.y[i]!;
    dy[i] = Math.min(hi, Math.max(lo, d));
    if (dy[i] !== d) { fixed = true; if (Math.abs(Math.log(d / nominal || 1e-9)) > Math.abs(Math.log(worst))) worst = d / nominal; }
  }
  if (fixed) {
    const sum = dy.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.N; i++) w.y[i + 1] = w.y[i]! + (dy[i]! * m.lengthPx) / sum;
    R.applied.push({ id: 'deform-guard-spacing', param: 'neck.system.operators', requested: worst, applied: Math.min(hi / nominal, Math.max(lo / nominal, worst)), reason: `écart entre stations ramené à [${free ? '0,05 ; 6' : '0,2 ; 3'}] × l'écart nominal (pas d'étirement incontrôlé ni d'inversion)` });
  }
  let low = Infinity;
  for (let i = 0; i <= w.N; i++) for (const [arr, fl] of [[w.aL, floorW], [w.aR, floorW], [w.bF, floorD], [w.bB, floorD]] as const) {
    if (arr[i]! < fl || !Number.isFinite(arr[i]!)) { low = Math.min(low, Number.isFinite(arr[i]!) ? arr[i]! : -Infinity); arr[i] = fl; }
  }
  if (low !== Infinity) R.applied.push({ id: 'deform-guard-section', param: 'neck.system.operators', requested: low, applied: floorW, reason: `section ramenée au plancher (${free ? '0,1' : '0,3'} de la largeur du haut) : pas d'inversion de surface` });
}
