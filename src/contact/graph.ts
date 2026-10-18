import type { ComponentId, FaceComponent } from './types';

/** Relations d'un composant dans l'arbre du visage. */
export interface Relations {
  readonly parent: ComponentId | null;
  readonly children: readonly ComponentId[];
  readonly siblings: readonly ComponentId[];
}

/**
 * Arbre des composants → relations (parent, enfants, frères). Les identifiants inconnus comme parent sont ignorés (un composant dont le
 * parent n'est pas enregistré est traité comme une racine) : retirer un composant ne casse pas les autres. Les frères d'un composant sont les
 * autres enfants de son parent (pour une racine : les autres racines).
 */
export function relations(components: readonly FaceComponent[]): Map<ComponentId, Relations> {
  const ids = new Set(components.map((c) => c.id));
  const parentOf = (c: FaceComponent): ComponentId | null => (c.parent !== null && ids.has(c.parent) ? c.parent : null);
  const out = new Map<ComponentId, Relations>();
  for (const c of components) {
    const p = parentOf(c);
    out.set(c.id, {
      parent: p,
      children: components.filter((o) => parentOf(o) === c.id).map((o) => o.id),
      siblings: components.filter((o) => o.id !== c.id && parentOf(o) === p).map((o) => o.id),
    });
  }
  return out;
}
