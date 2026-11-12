import { compileSceneCached } from '../compile';
import { faceLandmarks } from '../face';
import { hairGeometry } from '../face/hair';
import type { RandomFace } from '../generation/random-face';
import { checkAnatomy } from './anatomy';
import { checkGeometry } from './geometry';
import { checkStyle } from './style';
import { checkFaceEngine } from './face-engine';
import { checkStructure } from './structure';
import { checkContracts } from './contracts';
import { checkHairSim } from './hair-sim';
import { checkHairZones } from './hair-zones';
import { checkHairBoundary } from './hair-boundary';
import { checkNeck } from './neck';
import { checkHairShape } from './hair-shape';
import { checkHairSkull } from './hair-skull';
import { checkHairForm } from './hair-form';
import { checkHairEdge } from './hair-edge';
import { checkHairCoherence } from './hair-coherence';
import { checkHairDome } from './hair-dome';
import { checkHairRound } from './hair-round';
import { checkHeadHair } from './head-hair';
import { checkNoseRelief } from './nose-relief';
import { checkNoseView } from './nose-underview';
import { checkPerimeters } from './perimeters';
import { report, type Check, type Report } from './types';

export { checkHairZones } from './hair-zones';
export { checkHairBoundary, selfCrossings } from './hair-boundary';
export { checkHairShape, sharpTeeth } from './hair-shape';
export { checkHairSkull } from './hair-skull';
export { checkHairForm } from './hair-form';
export { checkHairEdge, silhouetteProfile, toothCount, maxBeyondRim, lowerFlare } from './hair-edge';
export { checkHairCoherence } from './hair-coherence';
export { checkHairDome, faceSweepEdges, shoulderRatio, DOME_LIMITS } from './hair-dome';
export { checkHairRound, roundMetrics, fringeAspect, ROUND_LIMITS, VOLUME_STYLES, type RoundMetrics, type FringeAspect } from './hair-round';
export { checkHeadHair } from './head-hair';
export { checkHairSim, hairSimStats, toleranceOf, type HairSimStats } from './hair-sim';

export { paletteStats, isVivid } from './style';
export type { Check, Report, VerifyLayer } from './types';
export { engineContext, REFERENCE_LIGHT, type EngineContext } from './face-engine';
export { checkPerimeters } from './perimeters';
export { checkNoseRelief, noseReliefChecks, NOSE_RELIEF_LIMITS } from './nose-relief';
export { checkNoseView, noseViewChecks, NOSE_VIEW_LIMITS } from './nose-underview';
export { checkStructure, structureContext, geometryDigest, type StructureContext } from './structure';

/**
 * Vérifie le rendu d'un visage complet sur les trois couches (géométrique, anatomique, style). Pure et déterministe :
 * recalcule la géométrie (mêmes entrées → mêmes mesures) et compile la scène pour inspecter le SVG réellement émis.
 */
export function verifyFace(face: RandomFace): Report {
  const lm = faceLandmarks(face.params, face.width, face.height);
  const geo = hairGeometry(face.params, lm);
  // Compilation en cache par contenu : si la scène vient d'être compilée pour le rendu, la vérification la relit au lieu de la recompiler (docs/PERF-3.md).
  const compiled = compileSceneCached({ width: Math.ceil(face.width), height: Math.ceil(face.height), objects: face.objects });
  const svg = compiled.ok ? compiled.svg : '';
  // L'hôte généré porte la peau en raccourci `{ preset, color }`.
  const skin = (face.objects[0] as { material: { color: string } }).material.color;
  const checks: Check[] = [];
  checks.push({ layer: 'geometry', id: 'scene-compiles', severity: 'error', ok: compiled.ok, value: Number(compiled.ok), limit: 1, message: 'la scène ne compile pas' });
  if (geo) checks.push(...checkGeometry(geo, lm));
  checks.push(...checkAnatomy(face, lm, geo));
  checks.push(...checkStyle(face.params, geo, svg, skin));
  // Moteur de visage (nez, menton, mâchoire, peau, ombres de contact, contours) : trois couches chiffrées.
  checks.push(...checkFaceEngine(face));
  // Moteur de structure (`anatomyEngine: 'structured'` seulement) : géométrie, anatomie, style de la structure.
  checks.push(...checkStructure(face));
  // Périmètres d'occupation des composants enfants (structured) : chaîne verticale, nez sous la zone entre les yeux, écart sourcil / paupière, rapports canoniques.
  checks.push(...checkPerimeters(face));
  // Relief du nez lu par le moteur d'éclairage : continuité, bornes, anatomie, style.
  checks.push(...checkNoseRelief(face));
  checks.push(...checkNoseView(face));
  // Contrats entre composants : mesures observables, corrections du résolveur, ordre anatomique, budget de rendu.
  checks.push(...checkContracts(face, svg));
  // Cou (moteur de cou) : géométrie, anatomie, style — voir `neck.ts`.
  checks.push(...checkNeck(face, svg));
  checks.push(...checkHairSim(face));
  checks.push(...checkHairZones(face));
  checks.push(...checkHairBoundary(face));
  checks.push(...checkHairShape(face));
  checks.push(...checkHairSkull(face));
  checks.push(...checkHairForm(face));
  checks.push(...checkHairEdge(face));
  checks.push(...checkHairCoherence(face));
  checks.push(...checkHairRound(face));
  checks.push(...checkHairDome(face));
  checks.push(...checkHeadHair(face));
  return report(checks);
}
export { measureEquivalence, equivalenceChecks, geometryOf, EQUIVALENCE_LIMITS, type EquivalenceMetrics } from './render-equivalence';
export { verifyEye, type EyeReport, type EyeMetrics } from './eye';
export { verifyBody } from './body';
export { checkNeck, checkNeckModel } from './neck';
export { verifyLegs } from './lower';
export { verifyVolumes, type VReport, type VCheck } from './volume';
export { verifyPixels } from './pixel';
export { verifyShoulders } from './shoulder';
export { verifyBack } from './back';
export { verifyJunctions } from './junction';
export { verifyProfileDepth } from './profile';
export { verifyLegs3D, PORTED_2D } from './legs3d';
export { verifyLit, litStats, type LitStats } from './lit';
export { verifyPipeline, registryChecks } from './pipeline';
