import { NeckSystem } from '../schema/neck-system';
import { buildStructures } from './anatomy';
import { resolveAttachments } from './attachments';
import { headPoseController, neckDeformationController, type HeadPose } from './controllers';
import type { NeckFrame } from './frame';
import { resolveMorphology } from './morphology';
import { buildRig } from './rig';
import { applyStack } from './stack';
import type { FaceNeckParams, HeadContext, NeckAttachmentGraph, NeckComposition, NeckModel, NeckSurfaceProfile } from './types';
import { baseWork, freezeFields, toStations } from './work';

/**
 * POINT D'ENTRÉE UNIQUE du moteur de cou : `neckModelOf(paramètres, contexte de tête, cadre) → NeckModel`.
 * Pipeline (chaque étape est un module testé à part) :
 *   morphologie (`morphology`) → géométrie primaire (`work.baseWork`) → pile d'opérateurs (`stack`, ordre canonique + garde-fous)
 *   → pose : HeadPoseController puis NeckDeformationController (`controllers`) → stations figées → structures (`anatomy`).
 * Pure et déterministe : mêmes paramètres + même graine ⇒ même modèle (test « reproductibilité »). Mémoïsé par le visage (`link.ts`).
 */
const NEUTRAL = NeckSystem.parse({});

export function neckModelOf(n: FaceNeckParams, ctx: HeadContext, frame: NeckFrame): NeckModel {
  const sys = n.system ?? NEUTRAL;
  const morphology = resolveMorphology(n, sys, ctx, frame);
  const rig = buildRig(sys);
  const w = baseWork(morphology, ctx);
  const stack = applyStack(w, sys.operators, morphology, sys.species);
  const pose: HeadPose = headPoseController(ctx, sys, rig, morphology);
  // Collisions d'accessoires : résolues AVANT le contact (le collier serre le cou là où il est vraiment) et avant le graphe.
  const att = resolveAttachments(sys.attachments, ctx, morphology);
  neckDeformationController(w, pose, morphology, rig, att.attachments);
  w.fields.simplify = Math.max(w.fields.simplify, 0);
  const fields = freezeFields(w);
  const structures = buildStructures(n, sys, pose, fields, ctx);
  const surface: NeckSurfaceProfile = { pattern: sys.surface.pattern, layout: sys.surface.layout, sizePx: sys.surface.size * morphology.aTop * 2, density: sys.surface.density, overlap: sys.surface.overlap, variation: sys.surface.variation, smoothThroat: sys.surface.smoothThroat, skinTension: sys.surface.skinTension, elementColor: sys.surface.elementColor };
  const graph: NeckAttachmentGraph = {
    parent: 'head', children: ['torso', 'shoulder-girdle'],
    anchors: [{ id: 'head-neck', u: 0, psi: 0 }, { id: 'neck-thorax', u: 1, psi: 0 }, { id: 'mastoid-L', u: 0.02, psi: -0.62 * Math.PI }, { id: 'mastoid-R', u: 0.02, psi: 0.62 * Math.PI }, { id: 'sternal-notch', u: 1, psi: 0 }],
    attachments: att.attachments,
  };
  const composition: NeckComposition = { species: sys.species, style: sys.style.mode, morphology, rig, stack, surface, graph, structures };
  return { ctx, composition, stations: toStations(w, morphology), fields, corrections: [...morphology.corrections, ...stack.corrections, ...pose.corrections, ...att.corrections] };
}
