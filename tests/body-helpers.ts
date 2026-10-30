import { generateRandomFace } from '../src';
import { anchorFromFace, type NeckAnchor } from '../src/body';

/** Ancre de cou d'un visage de référence (graine fixe) : tous les tests du corps partagent la même base de cou. */
export function referenceAnchor(seed = 11): NeckAnchor {
  const o = generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects[0] as unknown as { face: Parameters<typeof anchorFromFace>[0]; width: number; height: number };
  return anchorFromFace(o.face, o.width, o.height);
}
