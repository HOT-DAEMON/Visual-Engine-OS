import type { ComponentContract } from './registry';

/**
 * Ordre de résolution DÉTERMINISTE des composants : tri topologique (algorithme de Kahn) où, à chaque pas, le composant prêt
 * dont l'identifiant est le plus petit dans l'ordre alphabétique passe en premier. Mêmes contrats ⇒ même ordre, toujours.
 * Un cycle ou une dépendance vers un composant inconnu LÈVE une erreur qui nomme le problème (jamais d'ordre « au hasard »).
 */
export function resolutionOrder(contracts: readonly ComponentContract[]): string[] {
  const ids = new Set(contracts.map((c) => c.id));
  for (const c of contracts) for (const n of c.needs) if (!ids.has(n)) throw new Error(`contrat « ${c.id} » : dépendance inconnue « ${n} »`);
  const left = new Map(contracts.map((c) => [c.id, new Set(c.needs)]));
  const out: string[] = [];
  while (left.size) {
    const ready = [...left.entries()].filter(([, n]) => n.size === 0).map(([id]) => id).sort();
    if (!ready.length) throw new Error(`cycle de dépendances entre : ${[...left.keys()].sort().join(', ')}`);
    const next = ready[0] as string;
    out.push(next); left.delete(next);
    for (const n of left.values()) n.delete(next);
  }
  return out;
}

/** Fermeture transitive de `needs` (le composant lui-même inclus). */
export function upstream(contracts: readonly ComponentContract[], id: string): Set<string> {
  const by = new Map(contracts.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const walk = (x: string): void => { if (seen.has(x)) return; seen.add(x); for (const n of by.get(x)?.needs ?? []) walk(n); };
  walk(id);
  return seen;
}
