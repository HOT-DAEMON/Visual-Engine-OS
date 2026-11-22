import type { HeadSpec, View } from './head';
import type { LockSpec } from './lock';
import { GAP_MIN, imposes, relationsOf, SPAN_MIN, type Relation } from './occlusion';
import { paintLock, type PaintedLock } from './paint';

/**
 * FIABILITÉ DE L'ORDRE DE PROFONDEUR — sans vérité terrain, on mesure ce qu'une profondeur fiable doit satisfaire : elle ne change pas d'avis pour une vue
 * voisine. Pour chaque paire de mèches dont la relation IMPOSE un ordre sous la vue `view`, on regarde quelle mèche est devant (somme des écarts de
 * profondeur, pondérée) puis on refait la mesure sous `view` tournée de `dyaw` degrés : si la mèche de devant change, la profondeur n'était pas fiable.
 * `rate` = paires inversées / paires imposées. Une paire qui disparaît sous la vue voisine n'est pas comptée comme inversée (ni comme stable).
 *
 * LIMITE DE `rate` (mesurée, passe 4) : il juge une paire par le SIGNE NET de ses intervalles. Un vrai croisement (X : A devant puis derrière) a un net proche de 0
 * (confiance |net|/Σ|terme| médiane 0,18 pour les paires « inversées » contre 0,63 pour les stables, 326 paires) et bascule pour un rien, alors que le rendu, lui, DÉCOUPE
 * la mèche en tronçons et n'utilise jamais ce signe net. `segRate` mesure donc ce que le rendu consomme : la part de la longueur imposée (intervalles francs :
 * écart ≥ GAP_MIN, portée ≥ SPAN_MIN) dont le côté « devant » change sous la vue voisine, comparée au même paramètre de la mèche A.
 */
export interface Stability { readonly imposed: number; readonly flipped: number; readonly lost: number; readonly rate: number; readonly segRate: number; readonly segLength: number }

/** Côté « devant » (+1 : a, −1 : b) de la relation au paramètre `t` de la mèche a, ou 0 s'il n'y a pas d'intervalle franc en `t`. */
const sideAt = (r: Relation, t: number): number => { for (const iv of r.intervals) if (iv.gap >= GAP_MIN && Math.min(iv.a1 - iv.a0, iv.b1 - iv.b0) >= SPAN_MIN && t >= iv.a0 && t <= iv.a1) return iv.front === 'a' ? 1 : -1; return 0; };
const SEG_SAMPLES = 24;

const frontOf = (r: Relation): number => { let s = 0; for (const iv of r.intervals) s += (iv.front === 'a' ? 1 : -1) * iv.gap * Math.max(0.01, Math.min(iv.a1 - iv.a0, iv.b1 - iv.b0)); return Math.sign(s); };

export function orderStability(h: HeadSpec, specs: readonly LockSpec[], view: View, dyaw = 3, mode: 'weave' | 'all' = 'all', volume = mode === 'all'): Stability {
  const at = (v: View): { p: PaintedLock[]; rel: Map<string, Relation> } => { const p = specs.map((L) => paintLock(h, L, v)); const rel = new Map<string, Relation>(); for (const r of relationsOf(p, volume)) if (imposes(r, p, mode)) rel.set(`${r.a}|${r.b}`, r); return { p, rel }; };
  const A = at(view); const B = at({ ...view, yaw: view.yaw + dyaw });
  let imposed = 0; let flipped = 0; let lost = 0; let segSame = 0; let segFlip = 0;
  for (const [k, r] of A.rel) {
    if (r.kind !== 'cross') continue; const f = frontOf(r); if (f === 0) continue; imposed++; const q = B.rel.get(k); if (!q || q.kind !== 'cross') { lost++; continue; }
    const g = frontOf(q); if (g !== 0 && g !== f) flipped++;
    for (let i = 0; i < SEG_SAMPLES; i++) { const t = (i + 0.5) / SEG_SAMPLES; const x = sideAt(r, t); const y = sideAt(q, t); if (!x || !y) continue; if (x === y) segSame++; else segFlip++; }
  }
  return { imposed, flipped, lost, rate: imposed ? flipped / imposed : 0, segRate: segSame + segFlip ? segFlip / (segSame + segFlip) : 0, segLength: (segSame + segFlip) / SEG_SAMPLES };
}
