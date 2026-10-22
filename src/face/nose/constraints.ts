import { clamp01 } from '../../core/math';
import { Resolver, type Correction } from '../../core/resolve';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import type { NoseFrame } from './frame';

/**
 * CONTRAINTES ANATOMIQUES DU NEZ (T2). Les axes du nez sont indépendants dans le schéma ; ce fichier est l'ARBITRE qui empêche les combinaisons
 * impossibles. Chaque contrainte est une inégalité géométrique ou anatomique justifiée (jamais un chiffre « pour que ça ait l'air bien »),
 * elle RAMÈNE la valeur demandée à la plus proche valeur admissible et la NOTE (`applied`), pour que les tests, la vérification et la documentation
 * puissent dire exactement ce qui a été corrigé. Rien n'est corrigé en silence.
 */
export type NoseConstraint = Correction;

/** Valeurs EFFECTIVES (après arbitrage) des axes qui ont des contraintes. */
export interface ResolvedNose {
  readonly baseWidth: number;
  readonly domeSeparation: number;
  readonly columellaHang: number;
  readonly nostrilOpening: number | null;
  readonly philtrumWidth: number;
  readonly applied: readonly NoseConstraint[];
}

/** Abscisse du pied de l'aile (attache sur la joue) pour une largeur de base `bw` : 0,8 de la crête (neutre) ± 0,16 (voir `alae.ts`). */
export const baseHalfAt = (F: Pick<NoseFrame, 'alarX'>, bw: number): number => F.alarX * (0.8 + 0.16 * bw);

export function resolveNoseConstraints(p: FaceParams, F: NoseFrame, lm: FaceLandmarks): ResolvedNose {
  const n = p.nose;
  // Résolveur COMMUN (`core/resolve.ts`) : même procédure que les repères du visage — preuve que le mécanisme se répète vraiment.
  const R = new Resolver();
  const limit = (id: string, param: string, requested: number, lo: number, hi: number, reason: string): number => R.limit(id, param, requested, lo, hi, reason);
  // C1 — la base doit PORTER la columelle et une narine de chaque côté : demi-base ≥ demi-columelle + 9 % de la largeur des ailes.
  //      Sinon les narines sortiraient de leur plancher (le contrôle `nostrils-inside-alae` échouerait).
  const minBase = F.colHalf + 0.09 * F.nw;
  const bwMin = (minBase / F.alarX - 0.8) / 0.16;
  const baseWidth = limit('base-carries-nostrils', 'nose.base.width', n.base.width, Math.max(-1, bwMin), 1, 'la base du nez doit contenir la columelle et les deux narines');
  // C2 — deux dômes séparés doivent tenir DANS la largeur de la pointe : plus la pointe est étroite, moins ils peuvent s'écarter.
  const domeSeparation = limit('domes-inside-tip', 'nose.domes.separation', n.domes.separation, 0, 0.3 + 0.7 * n.tip.width, 'les dômes alaires doivent tenir dans la largeur de la pointe');
  // C3 — la columelle ne descend jamais sur la lèvre : son bas reste à 1,8 % de H au-dessus du haut de la lèvre supérieure.
  const room = (lm.lips.topY - 0.018 * lm.H - (F.baseY + 0.006 * F.H)) / (0.012 * F.H);
  const columellaHang = limit('columella-above-lip', 'nose.columella.hang', n.columella.hang, -1, Math.min(1, room), 'la columelle ne doit pas descendre sur la lèvre supérieure');
  // C4 — une pointe abaissée cache les narines : l'ouverture visible est plafonnée par la visibilité (0,25 + 0,75 × visibilité).
  const vis = n.nostrils.visibility ?? clamp01(0.55 + 0.45 * n.tip.rotation);
  const nostrilOpening = n.nostrils.opening === null ? null : limit('opening-vs-visibility', 'nose.nostrils.opening', n.nostrils.opening, 0, 0.25 + 0.75 * vis, 'une narine cachée par la pointe ne peut pas être grande ouverte');
  // C5 — la gouttière du philtrum reste plus étroite que 60 % de la bouche (au-delà, ce serait la bouche).
  const philtrumWidth = limit('philtrum-narrower-than-mouth', 'nose.philtrum.width', n.philtrum.width, 0, 1, 'largeur du philtrum bornée par la bouche');
  return { baseWidth, domeSeparation, columellaHang, nostrilOpening, philtrumWidth, applied: R.applied };
}
