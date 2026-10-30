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
import { report, type Check, type Report } from './types';

export { checkHairZones } from './hair-zones';
export { checkHairSim, hairSimStats, toleranceOf, type HairSimStats } from './hair-sim';

export { paletteStats, isVivid } from './style';
export type { Check, Report, VerifyLayer } from './types';
export { engineContext, REFERENCE_LIGHT, type EngineContext } from './face-engine';
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
  // Contrats entre composants : mesures observables, corrections du résolveur, ordre anatomique, budget de rendu.
  checks.push(...checkContracts(face, svg));
  checks.push(...checkHairSim(face));
  checks.push(...checkHairZones(face));
  return report(checks);
}
export { measureEquivalence, equivalenceChecks, geometryOf, EQUIVALENCE_LIMITS, type EquivalenceMetrics } from './render-equivalence';
export { verifyEye, type EyeReport, type EyeMetrics } from './eye';
export { verifyBody } from './body';
