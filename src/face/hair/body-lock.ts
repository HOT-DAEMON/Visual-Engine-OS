import type { HairLock } from './types';

/**
 * MÈCHE DE CORPS : fait partie du volume de la chevelure (par opposition aux décorations libres : rubans en S, cônes, volutes, épis).
 * Les sous-couches qui doublent la chevelure (masse arrière, masses d'étage) se calent sur le corps, jamais sur une décoration : une volute
 * partie à l'horizontale tirait un « bec » à la tempe de la masse arrière, et les rubans flottants gonflaient les masses d'étage en polygones
 * de 0,5 W hors du crâne (`docs/HAIR-BACK-MASS.md`).
 * Dans le moteur simulé, `flow` désigne la mèche principale d'un paquet (le corps) : toute mèche `sim` est donc de corps.
 */
export const isBodyLock = (l: HairLock): boolean => l.sim === true || l.kind === undefined || l.kind === 'lock' || l.kind === 'cheek' || l.kind === 'fringe';
