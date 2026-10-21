import { z } from 'zod';
import { Unit } from './primitives';

/**
 * CONTRAT DES RÉGIONS DU NEZ (suite de `face-nose.ts`) — tâches T1 et T2 de `docs/TODO-FACE-SPEC.md`.
 * Le nez est un VOLUME CONTINU découpé en régions anatomiques nommées. `face-nose.ts` porte déjà : racine, dorsum, pointe, ailes, narines, raccords.
 * Ce fichier ajoute ce qui manquait pour que chaque région du cahier des charges ait un contrat à elle :
 *   parois latérales (`sidewall`), dômes alaires (`domes`), sillon alaire (`groove`), base du nez (`base`), columelle (`columella`),
 *   philtrum et transition vers la lèvre supérieure (`philtrum`), ouverture et bords des narines (`nostrils.opening`, `nostrils.rim`).
 * RÈGLE DE COMPATIBILITÉ : chaque défaut est NEUTRE (la géométrie d'avant ne bouge pas d'un pixel tant qu'on ne touche pas aux nouveaux axes).
 * Les contraintes anatomiques entre axes (ex. base ≤ crête alaire) sont appliquées par `face/nose/constraints.ts`, jamais ici : le schéma décrit, le moteur arbitre.
 */

/** Parois latérales : les deux plans inclinés entre l'arête (dorsum) et le sillon alaire. */
export const NoseSidewall = z
  .object({
    /** Inclinaison des parois : 0 = plans presque horizontaux (nez large, plat), 1 = plans abrupts (nez étroit, haut). Règle la largeur de la bande d'ombre. */
    slope: Unit.default(0.5),
    /** Creusement de la paroi entre l'arête et le sillon alaire : 0 = plan, 1 = gouttière marquée. */
    concavity: Unit.default(0.3),
  })
  .strict();

/** Dômes des cartilages alaires : les deux bosses qui forment la pointe (lobule). */
export const NoseDomes = z
  .object({
    /** Relief des dômes (reflet et ombre propre de chaque dôme). */
    prominence: Unit.default(0.5),
    /** Écart entre les deux dômes : 0 = fondus en une seule pointe, 1 = pointe bifide (double dôme visible). */
    separation: Unit.default(0.35),
  })
  .strict();

/** Sillon alaire : le pli entre l'aile et la joue, comme région à part entière. */
export const NoseGroove = z
  .object({
    /** Profondeur du sillon (ombre propre, indépendante du fondu `junction.cheek`). */
    depth: Unit.default(0.5),
    /** Longueur : part du bord extérieur de l'aile que le sillon suit (0 = court, 1 = jusqu'à la jonction avec la pointe). */
    length: Unit.default(0.6),
  })
  .strict();

/** Base du nez (sous-nez / subnasale) : le plancher sur lequel reposent les narines. */
export const NoseBase = z
  .object({
    /** Largeur de la base PAR RAPPORT à la crête alaire : −1 = base étroite (ailes qui s'évasent au-dessus), 0 = neutre, +1 = base aussi large que la crête. */
    width: z.number().min(-1).max(1).default(0),
    /** Profondeur du plancher visible sous les narines (0 = ligne, 1 = plancher large). */
    depth: Unit.default(0.5),
  })
  .strict();

/** Columelle : la cloison entre les narines. Sa LARGEUR reste `nostrils.columella` (inchangé) ; ici, sa descente. */
export const NoseColumella = z
  .object({
    /** Descente de la columelle sous le bord des ailes : −1 = rétractée (ailes plus basses), 0 = alignée, +1 = pendante. */
    hang: z.number().min(-1).max(1).default(0),
  })
  .strict();

/** Philtrum : la gouttière verticale entre la base du nez et la lèvre supérieure, et sa transition vers la lèvre. */
export const NosePhiltrum = z
  .object({
    /** Profondeur de la gouttière. */
    depth: Unit.default(0.4),
    /** Largeur (au niveau de la lèvre, en fraction de la largeur de bouche). */
    width: Unit.default(0.5),
    /** Fondu avec la lèvre supérieure (0 = rebord net, 1 = transition douce). */
    blend: Unit.default(0.5),
  })
  .strict();

export type NoseSidewall = z.infer<typeof NoseSidewall>;
export type NoseBase = z.infer<typeof NoseBase>;
