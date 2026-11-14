import { assessVault, type VaultAssessment } from '../../skull/vault-constraints';
import { SkullParams } from '../../skull/types';
import type { EngineHead } from './face-model';

const cache = new WeakMap<EngineHead, VaultAssessment>();
/** Évaluation de la voûte d'une tête (paramètres validés UNE seule fois : le schéma compte une quarantaine de champs, le ré-analyser à chaque rangée ou sommet coûtait plus que le calcul). `fit.caricature` lève les contraintes strictes de plausibilité. */
export function vaultAssessment(e: EngineHead): VaultAssessment {
  let a = cache.get(e);
  if (!a) { a = assessVault(SkullParams.parse(e.fit.skull), (e.fit as { caricature?: boolean }).caricature === true); cache.set(e, a); }
  return a;
}
/** Paramètres du crâne d'une tête APRÈS contraintes strictes (les corrections sont enregistrées dans `vaultAssessment(e).corrections`). */
export const skullOf = (e: EngineHead): SkullParams => vaultAssessment(e).params;
