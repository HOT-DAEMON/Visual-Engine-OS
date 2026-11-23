/**
 * IDENTIFIANTS UNIQUES DANS `<defs>`.
 *
 * Cause constatée (docs/PERF-4.md) : `compileSurface(id, …)` émet déjà un `<clipPath id="${id}-clip">`, puis l'appelant (cheveux, barbe, moustache, favoris,
 * barbe naissante) en repousse un second sous le même nom, avec le même tracé : 58 visages sur 60 portaient au moins un identifiant dupliqué. Dans un SVG,
 * deux éléments de même `id` rendent la référence ambiguë (le premier gagne dans resvg, c'est indéfini selon les moteurs) et alourdissent le fichier.
 *
 * Règle : une définition STRICTEMENT identique (même texte) à une définition déjà vue pour le même `id` est supprimée (aucun pixel ne change : les références
 * pointent le même contenu). Une définition de même `id` mais de CONTENU DIFFÉRENT est conservée et signalée : c'est un vrai conflit à corriger à la source,
 * jamais à masquer.
 */

/** `id` de l'élément de tête d'une définition (`<clipPath id="…">…`), ou `null` si la définition n'en porte pas. */
export function leadingId(def: string): string | null {
  const m = /^<[A-Za-z][\w:-]*\s[^>]*?\bid="([^"]+)"/.exec(def);
  return m ? (m[1] as string) : null;
}

export interface DedupedDefs { readonly defs: string[]; readonly removed: number; readonly conflicts: string[] }

/** Supprime les définitions identiques répétées ; garde l'ordre (le premier exemplaire reste à sa place). */
export function dedupeDefs(defs: readonly string[]): DedupedDefs {
  const seen = new Map<string, string>();
  const out: string[] = [], conflicts: string[] = [];
  let removed = 0;
  for (const d of defs) {
    const id = leadingId(d);
    if (id === null) { out.push(d); continue; }
    const prev = seen.get(id);
    if (prev === undefined) { seen.set(id, d); out.push(d); continue; }
    if (prev === d) { removed++; continue; }
    conflicts.push(id); out.push(d); // contenu différent : on ne choisit pas à la place de l'émetteur
  }
  return { defs: out, removed, conflicts };
}

/** Tous les identifiants portés plus d'une fois dans un SVG complet (contrôle de sortie, utilisé par les tests et la vérification). */
export function duplicateIds(svg: string): string[] {
  const count = new Map<string, number>();
  for (const m of svg.matchAll(/\sid="([^"]+)"/g)) count.set(m[1] as string, (count.get(m[1] as string) ?? 0) + 1);
  return [...count].filter(([, n]) => n > 1).map(([id]) => id);
}
