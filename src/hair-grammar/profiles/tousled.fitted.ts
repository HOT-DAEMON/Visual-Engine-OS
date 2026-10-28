import type { LockSpec } from '../lock';
import data from './tousled.fitted.json';

/**
 * Mèches de la cellule 01 AJUSTÉES sur la référence par `scripts/hair-grammar/fit-01.ts` (analyse par synthèse, autofit.ts).
 * Ce sont des DONNÉES : la même primitive de mèche (lock.ts) et le même rendu (paint.ts) que le générateur de familles.
 * Régénérer : `npx tsx scripts/hair-grammar/fit-01.ts 40000 11 <départ.json>`.
 */
export const TOUSLED_FITTED: readonly LockSpec[] = data as unknown as LockSpec[];
