import { faceLandmarks } from '../../face';
import { buildBoundary } from '../../face/hair/boundary';
import type { FaceLandmarks } from '../../face/landmarks';
import type { FaceParams } from '../../schema';
import { regionFromBoundary } from '../hair-bridge';
import { regionKnots, relaxRegion, smoothRegion } from '../hair-region';
import type { HairlineSpec, HeadTurnSpec } from '../types';
import { hairVolumeOf } from '../hair-volume';
import { headSpecFromProfile, variedHead, type HeadSource, type VariedHead } from './from-face';

/**
 * TÊTE 3D D'UN HÔTE DU PIPELINE (`kind: 'head_3d'`). Même chaîne que les planches de graines (`from-face.ts` : crâne dérivé → mâchoire, nez, bouche, oreille des moteurs →
 * table de sections), mais la personne est celle de l'hôte, pas d'un tirage. Ce fichier est PUR : il ne connaît ni la scène ni le rendu SVG (c'est `src/render/head-3d.ts` qui lit l'hôte).
 *
 * Cheveux : `'host'` = la lisière RÉELLE de la coiffure de l'hôte (`face/hair/boundary` : implantation, pattes, arche de l'oreille, nuque, posée sur le crâne) via le pont
 * `hair-bridge.ts` ; la tête de face et la tête tournante ont donc la même coiffure (aux limites près de `HEAD-TURNTABLE-REMAINING.md` : lisière seulement, pas de volume de mèches) ;
 * `'short'` = la calotte courte dérivée du front et de la tempe. Chauve : aucune lisière (au-dessus du sommet).
 */
export type HairMode = 'host' | 'short';

/** Lisière sans cheveux : sous le sommet (y < 0), rien n'est « au-dessus » et aucun trait d'encre n'est tracé (le trait de lisière ne se dessine qu'à ≤ 0,03 U). */
const BALD: HairlineSpec = { knots: [[0, -0.2], [180, -0.2]] };

export function hostHairline(params: FaceParams, lm: FaceLandmarks): HairlineSpec {
  if (params.hair.style === 'bald') return BALD;
  const region = relaxRegion(smoothRegion(regionFromBoundary(buildBoundary(params, lm))));
  return { knots: regionKnots(region), region };
}

/** Spec de rotation d'un hôte : `src` = visage stylisé + crâne dérivé + couleurs ; `lm` = repères du visage de l'hôte (mêmes que ceux du visage de face). */
export function headSpecFromHost(src: HeadSource, lm: FaceLandmarks, hair: HairMode = 'host'): HeadTurnSpec {
  const bald = src.face.params.hair.style === 'bald';   // un hôte chauve reste chauve quel que soit le mode
  const spec = headSpecFromProfile(src, undefined, bald ? BALD : hair === 'host' ? hostHairline(src.face.params, lm) : undefined);
  // Volume 3D de la coiffure (coque, rideau, chignon, queue, tresses) : seulement avec la lisière réelle de l'hôte (même coiffure de face et en rotation).
  const vol = !bald && hair === 'host' ? hairVolumeOf(src.face.params, lm) : null;
  return vol ? { ...spec, hairVolume: vol } : spec;
}

/**
 * Tête d'une GRAINE coiffée comme son visage (planche de variété) : même chaîne que `variedHead` (visage + crâne dérivé), mais avec la lisière RÉELLE et le VOLUME de cheveux du visage de la
 * graine (coque, frange, épis, rideau, chignon, queue, tresses : `headSpecFromHost`). `variedHead` seul garde la calotte courte de la planche de référence (sans volume).
 * Les repères du visage sont ceux du moteur de visage, à la taille de la graine : les mêmes que ceux du visage de face.
 */
export function variedHairedHead(seed: number): VariedHead {
  const v = variedHead(seed), { params, width, height } = v.profile.face;
  return { ...v, spec: headSpecFromHost(v.profile, faceLandmarks(params, width, height), 'host') };
}
