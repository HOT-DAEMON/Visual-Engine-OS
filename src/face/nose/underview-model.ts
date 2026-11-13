import { UNDERVIEW_FIT } from './underview.generated';

/**
 * Fractions de la projection de la pointe (`nose.tip.projectionPx`) qui donnent l'élévation z de chaque région dans la vue de dessous.
 */
export interface UnderviewModel {
  /** z du bord du lobule (0 = plan du visage, 1 = sommet de la pointe). */
  readonly lobuleRim: number;
  /** z de la crête alaire. */
  readonly alarTop: number;
  /** z du pied de l'aile (attache sur la joue). */
  readonly alarBase: number;
  /** z du plan des narines. */
  readonly nostril: number;
}

/**
 * CONSTANTES ADOPTÉES PAR LE RENDU : jeu hérité du protocole v1, conservé A PRIORI, NON VALIDÉ par les mesures (docs/NOSE-UNDERVIEW-CALIB.md).
 * Raison : sous le protocole équitable v2 (tangage et lacet identifiés sur les observables, roulis compensé), AUCUN jeu de constantes ne rend ce modèle
 * prédictif de la hauteur du triangle, de sa base et du dépassement du sommet : ce jeu coûte 1,47 (médiane sans modèle ≈ 1,02) et l'optimum ajusté
 * (`UNDERVIEW_FITTED`) n'atteint 0,95 qu'en dégénérant (alarTop / alarBase sur la borne 0,95, enveloppe quasi ronde dès 40° de tangage, ellipses plates
 * de la référence impossibles). Changer le rendu sur cette base dégraderait la silhouette sans preuve de gain : on ne le fait pas.
 */
export const UNDERVIEW_MODEL: UnderviewModel = { lobuleRim: 0.5, alarTop: 0.5514, alarBase: 0.3415, nostril: 0.3751 };

/** Optimum du protocole v2 (résultat NÉGATIF conservé pour traçabilité ; ne pas utiliser pour le rendu). Régénéré par `scripts/nose-refs/fit-underview.ts`. */
export const UNDERVIEW_FITTED: UnderviewModel = UNDERVIEW_FIT.fitted;
