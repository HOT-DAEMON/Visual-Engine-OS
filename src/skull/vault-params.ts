import { z } from 'zod';

/**
 * PARAMÈTRES DE LA VOÛTE CRÂNIENNE (os frontal, pariétaux, temporaux, occipital, mastoïde, ptérion, vertex, glabelle) — mesures INDÉPENDANTES
 * ajoutées au moteur de crâne (`docs/SKULL-VAULT.md`). Tous sont des valeurs signées bornées dans [-1, 1], 0 = nominal : à 0 la tête est
 * IDENTIQUE à celle d'avant (aucune régression des têtes existantes). Aucun n'est dérivé d'un autre : une famille de crânes (dolicho-, brachy-,
 * mésocéphale, haut, bas, occiput plat…) est une COMBINAISON de ces mesures, jamais un modèle prédéfini.
 * Chaque paramètre déclare ses consommateurs dans `src/skull/vault-registry.ts` ; un test échoue si l'un n'est consommé nulle part ou n'a pas d'effet mesurable.
 */
const Signed = z.number().min(-1).max(1);
const S0 = Signed.default(0);

export const VaultParams = z
  .object({
    /** Os frontal — aplatissement du plan frontal : -1 bombé (arrondi) … +1 aplati (plan frontal plat). */
    frontalFlat: S0,
    /** Os frontal — largeur du front dans la moitié avant de la coupe : -1 étroit … +1 large. Indépendante de la largeur de la boîte crânienne. */
    frontalBreadth: S0,
    /** Pariétaux — bombement supérieur et latéral (éminences pariétales) : -1 effacé … +1 très marqué. */
    parietalBulge: S0,
    /** Pariétaux — aplatissement du sommet : -1 dôme pointu … +1 sommet plat. */
    parietalFlat: S0,
    /** Largeur de la boîte crânienne : -1 étroite … +1 large. INDÉPENDANTE de la largeur du visage (joues, pommettes, cheveux). */
    cranialBreadth: S0,
    /** Plans latéraux — convexité pariétale latérale : -1 plan … +1 très convexe. */
    parietalConvexity: S0,
    /** Temporaux — aplatissement du plan temporal : -1 bombé … +1 plat. */
    temporalFlat: S0,
    /** Temporaux — largeur latérale aux régions temporales : -1 étroite … +1 large. */
    templeBreadth: S0,
    /** Temporaux — creux temporal (fosse temporale) : -1 comblé / bombé … +1 creusé. */
    temporalHollow: S0,
    /** Région sphéno-temporale (ptérion) — transition entre plans frontal, temporal, pariétal : -1 anguleuse … +1 fondue. */
    planeTransition: S0,
    /** Occipital — aplatissement : -1 arrondi … +1 plat (brachycéphale). */
    occipitalFlat: S0,
    /** Occipital — inclinaison de la partie basse : -1 en surplomb (saillant) … +1 fuyant (incliné). */
    occipitalSlope: S0,
    /** Région mastoïdienne — relief derrière l'oreille : -1 effacé … +1 saillant. */
    mastoid: S0,
    /** Glabelle — relief médian entre les arcades sourcilières : -1 lisse … +1 proéminent. */
    glabella: S0,
    /** Ligne nuchale — crête transversale de la nuque : -1 absente … +1 marquée. */
    nuchalLine: S0,
    /** Sutures et crêtes temporales rendues en relief fin (données anatomiques toujours présentes) : 0 masquées … 1 visibles. */
    suturesShow: z.number().min(0).max(1).default(0),
    /** Tissus : part du relief osseux qui transparaît sous la peau (style / réalisme) : -1 modelé lisse … +1 os apparent. */
    boneShow: S0,
    /** Asymétrie crânienne PROPRE — éminences pariétales : le côté +x plus volumineux (+) ou moins (−). */
    asymParietal: S0,
    /** Asymétrie crânienne PROPRE — aplatissement occipital du côté +x (+) ou −x (−). */
    asymOccipital: S0,
    /** Asymétrie crânienne PROPRE — bombement frontal du côté −x (+) ou +x (−). */
    asymFrontal: S0,
    /** Asymétrie crânienne PROPRE — largeur de la voûte : le côté +x plus large (+) ou plus étroit (−). */
    asymWidth: S0,
    /** Part de l'asymétrie du VISAGE (yeux, bouche) reportée sur le crâne : 0 = crâne indépendant … 1 = reprise intégrale (comportement d'origine). */
    asymFaceCoupling: z.number().min(0).max(1).default(1),
  })
  .strict();
export type VaultParams = z.infer<typeof VaultParams>;

/** Liste ordonnée des clés (bornes, nominal) : source unique des planches de validation. */
export const VAULT_KEYS = Object.keys(VaultParams.shape) as (keyof VaultParams)[];
