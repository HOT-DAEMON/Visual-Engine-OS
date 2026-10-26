import { mulberry32 } from '../core/prng';
import { HAIR_STYLES, SkullParams } from '../skull/types';
import { generateRandomFace, type RandomFace, type RandomFaceOptions } from './random-face';

/**
 * Tête de profil aléatoire et déterministe : le VISAGE est celui de `generateRandomFace(seed)` (mêmes nez, lèvres, menton, mâchoire, oreille, peau,
 * cheveux : la tête de face et la tête de profil d'une même graine sont la même personne) ; les axes propres au crâne sont tirés d'un flux DÉRIVÉ
 * (`seed ^ 0x5c011`) : ajouter ou changer un axe du crâne ne bouge aucun tirage du visage. Tirage « centré » (moyenne de deux uniformes) :
 * les formes moyennes sont plus fréquentes que les extrêmes, comme dans une population.
 */
export interface RandomProfile {
  readonly seed: number;
  readonly face: RandomFace;
  readonly skull: SkullParams;
  readonly skin: string;
  readonly hair: string;
}

export function generateRandomProfile(seed: number, options: RandomFaceOptions & { hair?: SkullParams['hair'] } = {}): RandomProfile {
  const { hair: hairStyle, ...faceOpts } = options;
  const face = generateRandomFace(seed, { structure: true, ...faceOpts });
  const rnd = mulberry32((seed ^ 0x5c011) >>> 0);
  const u = (lo: number, hi: number): number => lo + (hi - lo) * ((rnd() + rnd()) / 2);
  const skull = SkullParams.parse({
    length: u(-0.8, 0.8), vaultHeight: u(0.1, 0.9), vaultPeak: u(0.2, 0.8), foreheadSlope: u(0.05, 0.8), frontalBulge: u(0.1, 0.9), browRidge: u(0, 0.9),
    occiput: u(0.1, 0.9), inion: u(0.05, 0.9), scalp: u(0.1, 0.9), maxilla: u(-0.7, 0.7), zygoma: u(0.1, 0.9), neckTilt: u(0.05, 0.85), neckDepth: u(0.1, 0.9),
    lordosis: u(0.1, 0.9), c7: u(0.1, 0.9), trapezius: u(0.1, 0.9), thyroid: u(0, 0.7),
    hair: hairStyle ?? (HAIR_STYLES[1 + Math.floor(rnd() * 3)] as SkullParams['hair']), napeHairline: u(0.2, 0.9),
  });
  const skin = (face.objects[0] as { material: { color: string } }).material.color;
  const hair = face.params.hair.color ?? '#4a3222';
  return { seed, face, skull, skin, hair };
}
