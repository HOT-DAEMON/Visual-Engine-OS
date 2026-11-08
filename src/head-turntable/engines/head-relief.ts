import type { EngineHead } from './face-model';
import { cheekRelief } from './cheek-relief';
import { hasSkullRelief, skullRelief } from './skull-relief';

/** Déplacement radial total (U) du maillage de la tête à la hauteur y et à l'azimut th : crâne (bosses pariétales, asymétrie) + joues (pommette, creux, masséter). */
export type HeadRelief = (y: number, th: number) => number;

const cache = new WeakMap<EngineHead, HeadRelief | null>();

/** Relief d'une tête issue d'un visage ; `null` pour la planche (silhouette mesurée : ses bosses et ses joues sont déjà dans les sections ajustées). Mémoïsé par tête. */
export function headRelief(e: EngineHead | undefined): HeadRelief | null {
  if (!e || !hasSkullRelief(e)) return null;
  let f = cache.get(e);
  if (f === undefined) { f = (y, th) => skullRelief(e, y, th) + cheekRelief(e, y, th); cache.set(e, f); }
  return f;
}
