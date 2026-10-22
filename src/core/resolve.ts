/**
 * PROCÉDURE DE RÉSOLUTION DÉTERMINISTE des contraintes entre composants — le mécanisme qui se RÉPÈTE dans le moteur
 * (arbitrage du nez, bouche dans le contour, cou entre menton et mâchoire, hauteur du menton sous la lèvre…) et qui n'existait que
 * sous forme de `clamp` silencieux ou recopié localement.
 *
 * Règles (le contrat) :
 *  1. une contrainte est une BORNE justifiée sur une grandeur : `limit(id, param, demandé, min, max, raison)` ;
 *  2. la valeur appliquée est `min(max, max(min, demandé))` — si les bornes se croisent (min > max) c'est le MAX qui l'emporte
 *     (la contrainte de non-débordement prime sur la contrainte de présence), règle unique, jamais décidée au cas par cas ;
 *  3. toute valeur qui change (au-delà de 1e-9) est ENREGISTRÉE (`Correction`) : demandé, appliqué, raison. Rien n'est corrigé en silence ;
 *  4. l'ordre des enregistrements est l'ordre des appels : la même entrée donne la même liste, dans le même ordre ;
 *  5. le résolveur ne lit ni n'écrit aucun état global : il est local à un calcul.
 * Ce qui ne se répète pas (les formules de forme) n'est PAS généralisé ici.
 */
export interface Correction {
  readonly id: string;
  /** Chemin du paramètre dont la valeur demandée a été ramenée (ex. `mouth.width`). */
  readonly param: string;
  readonly requested: number;
  readonly applied: number;
  readonly reason: string;
}

const TOL = 1e-9;

export class Resolver {
  readonly applied: Correction[] = [];

  limit(id: string, param: string, requested: number, min: number, max: number, reason: string): number {
    const v = Math.min(max, Math.max(min, requested));
    if (Math.abs(v - requested) > TOL) this.applied.push({ id, param, requested, applied: v, reason });
    return v;
  }
}
