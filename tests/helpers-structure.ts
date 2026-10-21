import { faceLandmarks, noseGeometry } from '../src/face';
import { structureGeometry } from '../src/face/structure';
import { mouthGeometry } from '../src/face/mouth';
import { FaceParams, type FaceParamsInput } from '../src/schema';

/** Dimensions de référence des tests de structure (celles d'un visage moyen des galeries). */
export const W = 300;
export const H = 380;

/** Construit un visage valide à partir d'un morceau de paramètres, avec le moteur de structure activé. */
export const face = (patch: FaceParamsInput = {}): FaceParams => FaceParams.parse({ anatomyEngine: 'structured', ...patch });

/** Tout ce que les tests lisent d'un visage : repères, nez, structure, bouche. */
export function bundle(patch: FaceParamsInput = {}) {
  const p = face(patch);
  const lm = faceLandmarks(p, W, H);
  const nose = noseGeometry(p, lm);
  return { p, lm, nose, g: structureGeometry(p, lm, nose), mouth: mouthGeometry(p, lm) };
}

/** Fusion profonde minimale pour composer des variantes dans les tests. */
export function set(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const out = structuredClone(obj);
  const keys = path.split('.');
  let c = out;
  for (const k of keys.slice(0, -1)) c = (c[k] ??= {}) as Record<string, unknown>;
  c[keys[keys.length - 1] as string] = value;
  return out;
}
