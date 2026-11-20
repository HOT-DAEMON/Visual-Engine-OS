import { Resolver, type Correction } from '../core/resolve';
import type { SkullParams } from './types';
import { transmission } from './vault-tissue';

/**
 * CONTRAINTES DE LA VOÛTE : STRICTES (impossibilités géométriques : appliquées par le `Resolver`, enregistrées, jamais silencieuses) et PRÉFÉRENCES MORPHOLOGIQUES
 * (combinaisons rares ou peu plausibles : MESURÉES et rapportées, jamais corrigées). Une caricature volontaire (`caricature: true`) lève les contraintes strictes de PLAUSIBILITÉ
 * mais jamais celles de validité du maillage (a > 0, zf > zb, exposants bornés), qui sont garanties par les modules de géométrie. Une relation anatomique ne bloque donc jamais un artiste.
 */
export interface Preference { readonly id: string; readonly label: string; readonly score: number /** 0 = rare … 1 = banal */ }
export interface VaultAssessment { readonly corrections: readonly Correction[]; readonly preferences: readonly Preference[]; readonly plausibility: number; readonly params: SkullParams }

const tri = (v: number, lo: number, hi: number): number => (v <= lo || v >= hi ? 0 : v < (lo + hi) / 2 ? (v - lo) / ((hi - lo) / 2) : (hi - v) / ((hi - lo) / 2));
const rare = (x: number): number => Math.max(0, 1 - Math.abs(x));   // 1 pour 0, 0 pour ±1

export function assessVault(k: SkullParams, caricature = false): VaultAssessment {
  const R = new Resolver(), p = { ...k };
  if (!caricature) {
    // STRICTES (plausibilité) : une voûte ne peut pas être à la fois creusée et bombée aux tempes ; un os ne peut pas montrer plus de relief que ce que ses tissus laissent passer.
    p.templeBreadth = R.limit('temple-hollow-width', 'skull.templeBreadth', k.templeBreadth, -1 + 0.5 * Math.max(0, k.temporalHollow), 1, 'un creux temporal profond ne coexiste pas avec des tempes très étroites (la fosse n’aurait plus de place)');
    p.occipitalSlope = R.limit('occiput-flat-slope', 'skull.occipitalSlope', k.occipitalSlope, -1 + 0.5 * Math.max(0, k.occipitalFlat), 1, 'un occiput très aplati ne peut pas surplomber fortement');
    // Passe 2 : un muscle temporal puissant comble la fosse ; un chignon est une bosse de l'écaille que l'aplatissement lambdoïde (brachycéphalie) supprime.
    p.temporalHollow = R.limit('muscle-fills-hollow', 'skull.temporalHollow', p.temporalHollow, -1, 1 - 0.5 * Math.max(0, k.temporalMuscle), 'un muscle temporal volumineux comble la fosse : elle ne peut pas être très creuse');
    p.occipitalBun = R.limit('flat-occiput-bun', 'skull.occipitalBun', k.occipitalBun, -1, 1 - 0.6 * Math.max(0, k.occipitalFlat), 'un occiput très aplati ne porte pas de chignon prononcé');
    // Passe 3 : un os apparent sous un cuir chevelu mince transmet jusqu'à ×1,6 : le sillon nuchal (le seul relief CREUX ajouté contre les reliefs de la nuque) ferait un saut supérieur à la borne de continuité (0,014 U ;
    // `docs/SKULL-VAULT-3.md`, table des plafonds). Son effet transmis est donc plafonné à celui d'une transmission de 1 (amplitude de base 0,022 U).
    const cap = Math.min(1, 1 / transmission('occipital', k.scalp, k.boneShow));
    p.nuchalGroove = R.limit('groove-tissue', 'skull.nuchalGroove', k.nuchalGroove, -cap, cap, 'un cuir chevelu mince sur un os apparent transmettrait un sillon plus net que la continuité du maillage ne le permet');
    // Un sillon profond juste sous une ligne nuchale forte fait une MARCHE (saillie puis creux sur 0,03 U) : plafond du sillon quand la ligne est marquée (×0,2 à ligne = 1 : mesuré, 0,5 laissait un saut de 0,0144 U avec tous les extrêmes anciens).
    const capL = 1 - 0.8 * Math.max(0, k.nuchalLine);
    p.nuchalGroove = R.limit('groove-line', 'skull.nuchalGroove', p.nuchalGroove, -capL, capL, 'un sillon profond sous une ligne nuchale très marquée ferait une marche plus raide que la continuité du maillage ne le permet');
  }
  const pref: Preference[] = [
    { id: 'robustesse', label: 'mastoïde, ligne nuchale, glabelle de même ordre (robustesse osseuse cohérente)', score: 1 - Math.min(1, (Math.abs(k.mastoid - k.nuchalLine) + Math.abs(k.mastoid - k.glabella)) / 2) },
    { id: 'brachy-occiput', label: 'occiput plat avec une tête longue : combinaison rare', score: 1 - Math.max(0, k.occipitalFlat) * Math.max(0, k.length) },
    { id: 'dolicho-largeur', label: 'boîte crânienne large avec une tête très longue : combinaison rare', score: 1 - Math.max(0, k.cranialBreadth) * Math.max(0, k.length) },
    { id: 'front-voute', label: 'front très plat avec un sommet très pointu : combinaison rare', score: 1 - Math.max(0, k.frontalFlat) * Math.max(0, -k.parietalFlat) },
    { id: 'tissus', label: 'os très apparent sous un cuir chevelu très épais : combinaison rare', score: 1 - Math.max(0, k.boneShow) * tri(k.scalp, 0.55, 1.2) },
    { id: 'asymetrie', label: 'asymétries propres de même ordre : une plagiocéphalie dominante est plus fréquente que neuf', score: rare((Math.abs(k.asymParietal) + Math.abs(k.asymOccipital) + Math.abs(k.asymFrontal) + Math.abs(k.asymWidth) + Math.abs(k.asymMastoid) + Math.abs(k.asymParietalHeight) + Math.abs(k.asymParietalAzimuth) + Math.abs(k.asymFrontalEminence) + Math.abs(k.asymMastoidDirection)) / 9) },
    { id: 'front-juvenile-robuste', label: 'bosses frontales marquées avec de fortes arcades sourcilières : combinaison rare (front juvénile ou robuste, rarement les deux)', score: 1 - Math.max(0, k.frontalEminence) * Math.max(0, k.browArch) },
    { id: 'muscle-crete', label: 'muscle temporal puissant sans crête temporale : combinaison rare (le muscle marque son insertion)', score: 1 - Math.max(0, k.temporalMuscle - Math.max(0, k.temporalLine)) },
    { id: 'chignon-brachy', label: 'chignon occipital avec une tête très courte : combinaison rare', score: 1 - Math.max(0, k.occipitalBun) * Math.max(0, -k.length) },
  ];
  const plausibility = pref.reduce((s, q) => s + q.score, 0) / pref.length;
  return { corrections: R.applied, preferences: pref, plausibility, params: p };
}
