import { mulberry32 } from '../core/prng';
import { VaultParams, VAULT_KEYS } from './vault-params';

/**
 * CORRÉLATIONS PROBABILISTES FACULTATIVES entre mesures de voûte : des TENDANCES, jamais des règles. `drawVault(seed, { variety, tendency })` tire chaque mesure
 * indépendamment (variety : amplitude, 0 = nominal … 1 = toute la plage) puis, avec la force `tendency` ∈ [0, 1] (0 = indépendantes, comportement par défaut), rapproche
 * quelques mesures d'une valeur suggérée par une autre : t·ρ · cible + (1 − t·ρ) · tirage. Même avec tendency = 1 chaque mesure garde sa part de hasard (ρ < 1) ;
 * l'artiste peut toujours poser n'importe quelle combinaison (les corrélations ne sont utilisées que par le tirage aléatoire).
 */
export const TENDENCIES: readonly { readonly from: keyof VaultParams; readonly to: keyof VaultParams; readonly sign: 1 | -1; readonly rho: number; readonly why: string }[] = [
  { from: 'mastoid', to: 'nuchalLine', sign: 1, rho: 0.6, why: 'la robustesse osseuse (insertions musculaires) se retrouve à la nuque et derrière l\'oreille' },
  { from: 'nuchalLine', to: 'glabella', sign: 1, rho: 0.5, why: 'crêtes d\'insertion et arcades sourcilières évoluent ensemble' },
  { from: 'occipitalFlat', to: 'cranialBreadth', sign: 1, rho: 0.45, why: 'brachycéphalie : occiput plat et boîte plus large' },
  { from: 'temporalHollow', to: 'templeBreadth', sign: -1, rho: 0.4, why: 'une fosse temporale creuse accompagne des tempes plus fines' },
  { from: 'parietalFlat', to: 'parietalBulge', sign: -1, rho: 0.4, why: 'un sommet plat s\'accompagne de bosses pariétales plus latérales' },
  { from: 'boneShow', to: 'mastoid', sign: 1, rho: 0.3, why: 'un os apparent laisse mieux lire les reliefs osseux' },
];

export interface VaultDraw { readonly variety?: number; readonly tendency?: number }
export function drawVault(seed: number, o: VaultDraw = {}): VaultParams {
  const rnd = mulberry32((seed ^ 0x5c4a17) >>> 0), variety = o.variety ?? 1, t = o.tendency ?? 0;
  const v: Record<string, number> = {};
  for (const k of VAULT_KEYS) {
    const r = rnd() * 2 - 1;   // tirage indépendant, toujours consommé dans le même ordre : l'activation des tendances ne décale aucune graine
    v[k] = k === 'suturesShow' ? 0 : k === 'asymFaceCoupling' ? 1 : Math.max(-1, Math.min(1, variety * r));
  }
  if (t > 0) for (const c of TENDENCIES) v[c.to] = Math.max(-1, Math.min(1, t * c.rho * c.sign * v[c.from]! + (1 - t * c.rho) * v[c.to]!));
  return VaultParams.parse(v);
}
