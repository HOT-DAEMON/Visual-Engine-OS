import { compileScene } from '../compile';
import { faceLandmarks } from '../face';
import { hairGeometry } from '../face/hair';
import type { RandomFace } from '../generation/random-face';
import { checkAnatomy } from './anatomy';
import { checkGeometry } from './geometry';
import { checkStyle } from './style';
import { checkFaceEngine } from './face-engine';
import { report, type Check, type Report } from './types';

export { paletteStats, isVivid } from './style';
export type { Check, Report, VerifyLayer } from './types';
export { engineContext, REFERENCE_LIGHT, type EngineContext } from './face-engine';

/**
 * Vérifie le rendu d'un visage complet sur les trois couches (géométrique, anatomique, style). Pure et déterministe :
 * recalcule la géométrie (mêmes entrées → mêmes mesures) et compile la scène pour inspecter le SVG réellement émis.
 */
export function verifyFace(face: RandomFace): Report {
  const lm = faceLandmarks(face.params, face.width, face.height);
  const geo = hairGeometry(face.params, lm);
  const compiled = compileScene({ width: Math.ceil(face.width), height: Math.ceil(face.height), objects: face.objects });
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
  return report(checks);
}
