import type { HeadSpec, View } from './head';
import type { LockSpec } from './lock';
import { imposes, relationsOf, type Relation } from './occlusion';
import { paintLock, type PaintedLock } from './paint';

/**
 * FIABILITÉ DE L'ORDRE DE PROFONDEUR — sans vérité terrain, on mesure ce qu'une profondeur fiable doit satisfaire : elle ne change pas d'avis pour une vue
 * voisine. Pour chaque paire de mèches dont la relation IMPOSE un ordre sous la vue `view`, on regarde quelle mèche est devant (somme des écarts de
 * profondeur, pondérée) puis on refait la mesure sous `view` tournée de `dyaw` degrés : si la mèche de devant change, la profondeur n'était pas fiable.
 * `rate` = paires inversées / paires imposées. Une paire qui disparaît sous la vue voisine n'est pas comptée comme inversée (ni comme stable).
 */
export interface Stability { readonly imposed: number; readonly flipped: number; readonly lost: number; readonly rate: number }

const frontOf = (r: Relation): number => { let s = 0; for (const iv of r.intervals) s += (iv.front === 'a' ? 1 : -1) * iv.gap * Math.max(0.01, Math.min(iv.a1 - iv.a0, iv.b1 - iv.b0)); return Math.sign(s); };

export function orderStability(h: HeadSpec, specs: readonly LockSpec[], view: View, dyaw = 3, mode: 'weave' | 'all' = 'all', volume = mode === 'all'): Stability {
  const at = (v: View): { p: PaintedLock[]; rel: Map<string, Relation> } => { const p = specs.map((L) => paintLock(h, L, v)); const rel = new Map<string, Relation>(); for (const r of relationsOf(p, volume)) if (imposes(r, p, mode)) rel.set(`${r.a}|${r.b}`, r); return { p, rel }; };
  const A = at(view); const B = at({ ...view, yaw: view.yaw + dyaw });
  let imposed = 0; let flipped = 0; let lost = 0;
  for (const [k, r] of A.rel) { if (r.kind !== 'cross') continue; const f = frontOf(r); if (f === 0) continue; imposed++; const q = B.rel.get(k); if (!q || q.kind !== 'cross') { lost++; continue; } const g = frontOf(q); if (g !== 0 && g !== f) flipped++; }
  return { imposed, flipped, lost, rate: imposed ? flipped / imposed : 0 };
}
