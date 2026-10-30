import { clamp } from '../core/math';

/**
 * HIÉRARCHIE MUSCULAIRE — de « non musclé » à « très très musclé » (SOURCE UNIQUE, partagée par le tronc, les bras et les jambes).
 * Les références (`references/anatomy/ref-02` muscles colorés, `ref-04` écorché de face/profil) montrent que le relief n'apparaît pas d'un bloc :
 * les MASSES (quadriceps, deltoïde, pectoraux) se lisent d'abord, puis leurs chefs, puis les séparations fines (tendons, intersections, faisceaux).
 * Le palier continu `T ∈ [0,5]` vient de la définition visible `vis` du cadre (musculature × âge × (1 − adiposité masquante)) : il ne dépend
 * d'aucune « origine » ni d'aucun autre axe. Chaque atome musculaire déclare le palier `min` où il commence à se lire ; il est pleinement
 * visible à `min + 1` (fondu d'un palier, jamais d'apparition brutale).
 */
export const TIER_NAMES = ['non musclé', 'faiblement musclé', 'tonique', 'athlétique', 'musclé', 'très très musclé'] as const;
export type TierName = (typeof TIER_NAMES)[number];
/** Palier continu 0…5 depuis la définition visible `vis` (0…1) du cadre du corps. */
export const tierOf = (vis: number): number => clamp(vis * 5.2, 0, 5);
export const tierName = (t: number): TierName => TIER_NAMES[Math.min(5, Math.max(0, Math.round(t)))] as TierName;
/** Opacité relative d'un atome de palier `min` quand le corps est au palier `t` : 0 avant `min − 1`… 1 dès `min`. */
export const reveal = (t: number, min: number): number => clamp(t - min + 1, 0, 1);

export interface TierRule { readonly min: number }
/** Palier d'apparition par muscle (identifiant SANS suffixe de côté). Un muscle absent de la table est toujours montré (masses, enveloppes). */
const R = (min: number): TierRule => ({ min });
export const MUSCLE_TIERS: Readonly<Record<string, TierRule>> = {
  // tronc
  'pec.clavicular': R(2), 'pec.sternal': R(2), 'abs.r1': R(2.5), 'abs.r2': R(2), 'abs.r3': R(3), 'abs.r4': R(3.5),
  'serratus.slip1': R(3), 'serratus.slip2': R(3.5), 'serratus.slip3': R(4), 'serratus.slip4': R(4.5), 'torso.oblique.external': R(2.5), 'torso.lat': R(3),
  // bras
  'deltoid.anterior': R(2), 'deltoid.lateral': R(2.5), 'biceps.long-head': R(2.5), 'biceps.short-head': R(3), brachialis: R(3), coracobrachialis: R(3.5),
  'triceps.long-head': R(3), 'triceps.lateral-head': R(2.5), brachioradialis: R(2), 'pronator-teres': R(3), 'flexor-carpi-radialis': R(3),
  'palmaris-longus': R(3.5), 'flexor-digitorum-superficialis': R(3), 'flexor-carpi-ulnaris': R(2.5), 'extensor-carpi-radialis-longus': R(3),
  'extensor-carpi-radialis-brevis': R(3.5), 'extensor-digitorum': R(2.5), 'extensor-carpi-ulnaris': R(3),
  'abductor-pollicis-longus': R(3.5), 'extensor-pollicis-brevis': R(4),
  // bassin et cuisse
  'rectus-femoris': R(1.5), 'vastus-lateralis': R(1), 'vastus-medialis': R(2), sartorius: R(2), gracilis: R(3), 'adductor-longus': R(2.5), pectineus: R(3.5),
  'tensor-fasciae-latae': R(2.5), 'iliotibial-band': R(3.5), 'gluteus-medius': R(3),
  // jambe
  'gastrocnemius.medial': R(1), 'gastrocnemius.lateral': R(1.5), soleus: R(2.5), 'tibialis-anterior': R(1.5), 'extensor-digitorum-longus': R(3),
  'peroneus-longus': R(3), 'peroneus-brevis': R(3.5), 'extensor-hallucis-longus': R(3.5),
};
/** Règle d'un atome par son identifiant complet (`biceps.long-head.L` → `biceps.long-head`). */
export const tierRule = (id: string): TierRule | undefined => MUSCLE_TIERS[id.replace(/\.(L|R)$/, '')];
