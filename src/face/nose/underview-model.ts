import { UNDERVIEW_FIT } from './underview.generated';

/**
 * Fractions de la projection de la pointe (`nose.tip.projectionPx`) qui donnent l'élévation z de chaque région dans la vue de dessous.
 * Les valeurs viennent de `underview.generated.ts` (ajustement `scripts/nose-refs/fit-underview.ts` sur references/nez/measures-04.json) : rien n'est saisi à la main.
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
export const UNDERVIEW_MODEL: UnderviewModel = UNDERVIEW_FIT.model;
