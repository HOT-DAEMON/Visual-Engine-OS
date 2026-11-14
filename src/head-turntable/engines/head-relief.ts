import type { EngineHead } from './face-model';
import { cheekRelief } from './cheek-relief';
import { hasSkullRelief, skullRelief } from './skull-relief';
import { vaultOver, vaultRelief } from './vault-relief';
import { vaultRise, warpY } from './vault-model';

/** Déplacement radial total (U) du maillage de la tête à la hauteur y et à l'azimut th : crâne (bosses pariétales, asymétrie) + joues (pommette, creux, masséter). */
export type HeadRelief = (y: number, th: number) => number;

const cache = new WeakMap<EngineHead, HeadRelief | null>();

/** Relief d'une tête issue d'un visage ; `null` pour la planche (silhouette mesurée : ses bosses et ses joues sont déjà dans les sections ajustées). Mémoïsé par tête. */
export function headRelief(e: EngineHead | undefined): HeadRelief | null {
  if (!e || !hasSkullRelief(e)) return null;
  let f = cache.get(e);
  if (f === undefined) { const rise = vaultRise(e); f = (y, th) => { const ys = warpY(y, rise); return skullRelief(e, ys, th) + vaultRelief(e, ys, th) + cheekRelief(e, ys, th); }; cache.set(e, f); }   // y du maillage → hauteur source (sommet relevé / abaissé)
  return f;
}

/** Dépassement toléré (U) de la demi-largeur de la section à la hauteur y du maillage : 0 sauf asymétrie de largeur de la voûte. */
export const headReliefOver = (e: EngineHead | undefined, y: number): number => (e && hasSkullRelief(e) ? vaultOver(e, warpY(y, vaultRise(e))) : 0);
