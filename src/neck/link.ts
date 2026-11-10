import { memoPure } from '../perf';
import { halfWidthAt } from '../face';
import type { FaceLandmarks } from '../face/landmarks';
import type { FaceParams } from '../schema';
import { neckModelOf } from './model';
import type { HeadContext, NeckModel } from './types';

/**
 * LIEN VISAGE → COU. Le cou ne lit de la tête que `HeadContext` (repères déjà calculés par le moteur de visage + articulation + lacet) ;
 * le cadre (`half`, `topY`, `bottomY`) est `lm.neck`, produit par `frame.ts` : source unique, partagée avec le corps et les cheveux.
 */
export function contextFromLandmarks(p: FaceParams, lm: FaceLandmarks, headYawDeg = 0, sex = 0): HeadContext {
  return { W: lm.W, H: lm.H, chinY: lm.chinY, jawY: lm.jawY, chinHalf: lm.outline.chinHalf, headHalfTop: halfWidthAt(lm.outline, lm.neck.topY), headHalfJaw: halfWidthAt(lm.outline, lm.jawY), chinProjection: p.chin.projection, headPitchDeg: p.deform.articulation.headPitchDeg, headYawDeg, jawOpen: Math.min(1, Math.max(0, lm.jaw.drop / (0.08 * lm.H))), clench: p.deform.articulation.clench, sex };
}

const cached = memoPure('neck-model', 'geometry', neckModelOf, 128);

/** Modèle de cou d'un visage (mémoïsé par contenu : même visage ⇒ même objet, donc mêmes silhouettes en cache). */
export const neckModelFor = (p: FaceParams, lm: FaceLandmarks, headYawDeg = 0, sex = 0): NeckModel => cached(p.neck, contextFromLandmarks(p, lm, headYawDeg, sex), lm.neck);
