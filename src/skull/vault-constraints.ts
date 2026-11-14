import { Resolver, type Correction } from '../core/resolve';
import type { SkullParams } from './types';

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
  }
  const pref: Preference[] = [
    { id: 'robustesse', label: 'mastoïde, ligne nuchale, glabelle de même ordre (robustesse osseuse cohérente)', score: 1 - Math.min(1, (Math.abs(k.mastoid - k.nuchalLine) + Math.abs(k.mastoid - k.glabella)) / 2) },
    { id: 'brachy-occiput', label: 'occiput plat avec une tête longue : combinaison rare', score: 1 - Math.max(0, k.occipitalFlat) * Math.max(0, k.length) },
    { id: 'dolicho-largeur', label: 'boîte crânienne large avec une tête très longue : combinaison rare', score: 1 - Math.max(0, k.cranialBreadth) * Math.max(0, k.length) },
    { id: 'front-voute', label: 'front très plat avec un sommet très pointu : combinaison rare', score: 1 - Math.max(0, k.frontalFlat) * Math.max(0, -k.parietalFlat) },
    { id: 'tissus', label: 'os très apparent sous un cuir chevelu très épais : combinaison rare', score: 1 - Math.max(0, k.boneShow) * tri(k.scalp, 0.55, 1.2) },
    { id: 'asymetrie', label: 'asymétries propres de même ordre : une plagiocéphalie dominante est plus fréquente que quatre', score: rare((Math.abs(k.asymParietal) + Math.abs(k.asymOccipital) + Math.abs(k.asymFrontal) + Math.abs(k.asymWidth)) / 4) },
  ];
  const plausibility = pref.reduce((s, q) => s + q.score, 0) / pref.length;
  return { corrections: R.applied, preferences: pref, plausibility, params: p };
}
