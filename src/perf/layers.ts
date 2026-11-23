/**
 * COMPTEURS PAR COUCHE de la figure (docs/PERF-4.md) : pour chaque couche (champ de relief, AO, ombre portée, G-buffer, occlusion, ombrage, PNG…), le nombre
 * de calculs réels, de réutilisations (« hits ») et le temps réel passé. Toujours actifs (un `hrtime` par couche, soit quelques appels par figure : négligeable) ;
 * ils alimentent le banc et les budgets par composant (`budget.ts`). N'ont aucune influence sur les résultats.
 */
export interface LayerStat { calls: number; hits: number; ms: number }
const stats = new Map<string, LayerStat>();
const stat = (name: string): LayerStat => { let s = stats.get(name); if (!s) { s = { calls: 0, hits: 0, ms: 0 }; stats.set(name, s); } return s; };
const now = (): number => Number(process.hrtime.bigint()) / 1e6;

/** Exécute le calcul réel d'une couche et compte sa durée. */
export function timedLayer<T>(name: string, fn: () => T): T {
  const t0 = now(); try { return fn(); } finally { const s = stat(name); s.calls++; s.ms += now() - t0; }
}
/** Compte une réutilisation (couche servie par le cache, aucun calcul). */
export const layerHit = (name: string): void => { stat(name).hits++; };
export const layerStats = (): Record<string, LayerStat> => Object.fromEntries([...stats].map(([k, v]) => [k, { ...v }]));
export const resetLayerStats = (): void => stats.clear();

/**
 * Cache LRU BORNÉ d'une couche : les valeurs sont de gros tampons typés (un G-buffer à 1 100 px pèse ≈ 100 Mo), d'où des bornes de 2 à 4 entrées. Les valeurs sont
 * IMMUABLES pour les appelants. La clé est une chaîne de contenu ; un objet volumineux et immuable (jeu de volumes, G-buffer) est désigné par `idOf` (identité).
 */
const caches: LayerCache<unknown>[] = [];
export class LayerCache<V> {
  private readonly map = new Map<string, V>();
  constructor(readonly name: string, private readonly max: number) { caches.push(this as LayerCache<unknown>); }
  /** Valeur en cache (comptée comme réutilisation) ou calcul réel (compté et chronométré), puis mémorisation. */
  get(key: string, make: () => V): V {
    const v = this.map.get(key);
    if (v !== undefined) { layerHit(this.name); this.map.delete(key); this.map.set(key, v); return v; }
    const made = timedLayer(this.name, make);
    this.map.set(key, made);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
    return made;
  }
  clear(): void { this.map.clear(); }
}
/** Vide toutes les couches (mesures à froid, tests). */
export const clearLayerCaches = (): void => caches.forEach((c) => c.clear());
const ids = new WeakMap<object, number>(); let nextId = 1;
/** Identifiant stable d'un objet IMMUABLE (identité), pour l'inclure dans une clé de cache. */
export const idOf = (o: object): number => { let i = ids.get(o); if (i === undefined) { i = nextId++; ids.set(o, i); } return i; };
