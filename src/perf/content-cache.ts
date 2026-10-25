/**
 * Cache ADRESSÉ PAR LE CONTENU : la clé est une sérialisation canonique des paramètres, jamais une identité d'objet.
 *
 * Contrat (ce qui rend un cache sûr ici) :
 *  1. la fonction mise en cache est PURE (mêmes paramètres → même résultat, aucun état caché, aucun hasard hors des paramètres) ;
 *  2. la clé couvre TOUS ses paramètres (sérialisation canonique : clés d'objet triées, nombres exacts) ;
 *  3. les valeurs rendues sont traitées comme IMMUABLES par les appelants (le cache rend la même référence) ;
 *  4. éviction LRU bornée (`max` entrées) : la mémoire est bornée, jamais de fuite.
 * Les compteurs (`hits`, `misses`) sont exposés : un cache dont le taux de réussite est nul est un coût sans gain, et le banc le montre.
 */
import { clock, type Stage } from './clock';

/** Sérialisation canonique : objets à clés triées, `undefined` omis, nombres tels quels (pas d'arrondi : deux flottants différents = deux clés). */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return typeof v === 'number' && !Number.isFinite(v) ? `"${v}"` : JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) {
    let out = '[';
    for (let i = 0; i < v.length; i++) out += (i ? ',' : '') + canonical(v[i]);
    return `${out}]`;
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  let out = '{'; let first = true;
  for (const k of keys) {
    const x = o[k];
    if (x === undefined) continue;
    out += `${first ? '' : ','}${quoted(k)}:${canonical(x)}`;
    first = false;
  }
  return `${out}}`;
}

/** `JSON.stringify(clé)` mémoïsé : les clés d'objet se répètent des milliers de fois par visage (profil : `canonical` ≈ 8 % du pipeline). */
const QUOTED = new Map<string, string>();
function quoted(k: string): string {
  let q = QUOTED.get(k);
  if (q === undefined) { q = JSON.stringify(k); if (QUOTED.size < 4096) QUOTED.set(k, q); }
  return q;
}

export interface CacheStats { readonly name: string; readonly hits: number; readonly misses: number; readonly size: number }

export class ContentCache<V> {
  private readonly map = new Map<string, V>();
  hits = 0;
  misses = 0;
  constructor(readonly name: string, private readonly max = 256) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) { this.misses++; return undefined; }
    this.hits++;
    this.map.delete(key); this.map.set(key, v); // rafraîchit la récence (LRU)
    return v;
  }

  set(key: string, v: V): void {
    this.map.set(key, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }

  clear(): void { this.map.clear(); this.hits = 0; this.misses = 0; }
  stats(): CacheStats { return { name: this.name, hits: this.hits, misses: this.misses, size: this.map.size }; }
}

/** Registre des caches du processus (pour le rapport du banc). */
const registry: ContentCache<unknown>[] = [];
export const cacheStats = (): CacheStats[] => registry.map((c) => c.stats());
export const clearCaches = (): void => registry.forEach((c) => c.clear());

/**
 * Enveloppe une fonction pure : résultat mémoïsé par contenu des arguments, durée du calcul réel comptée dans l'étape `stage`.
 * Un hit ne coûte que la sérialisation de la clé.
 */
export function memoPure<A extends unknown[], R>(name: string, stage: Stage, fn: (...a: A) => R, max = 256): (...a: A) => R {
  const cache = new ContentCache<R>(name, max);
  registry.push(cache as ContentCache<unknown>);
  return (...a: A): R => {
    const key = canonical(a);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const v = clock.time(stage, () => fn(...a));
    cache.set(key, v);
    return v;
  };
}
