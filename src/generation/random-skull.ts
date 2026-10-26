import { mulberry32 } from '../core/prng';
import { deriveSkull, type Derivation, type DerivedAxis } from '../skull/derive';
import { profileEyeData, type ProfileEyeData } from '../skull/eye-data';
import { SkullParams } from '../skull/types';
import { generateRandomFace, type RandomFace, type RandomFaceOptions } from './random-face';

/**
 * Tête de profil aléatoire et déterministe : le VISAGE est celui de `generateRandomFace(seed)` (mêmes nez, lèvres, menton, mâchoire, oreille, peau,
 * yeux, cheveux, pilosité : la tête de face et la tête de profil d'une même graine sont la même personne). Le CRÂNE est maintenant DÉRIVÉ de la face
 * (`skull/derive.ts` : largeur de face → indice céphalique → longueur ; front, pommettes, cou) puis reçoit une petite variation libre BORNÉE ; seuls
 * les axes que la face ne détermine pas (occiput, inion, maxillaire, C7, lordose, trapèze, thyroïde, vaultPeak, scalp, inclinaison du cou, nuque) sont
 * tirés librement. Flux dérivé (`seed ^ 0x5c011`) : ajouter un axe ne bouge aucun tirage du visage, et l'ordre des tirages est inchangé (les axes
 * non dérivés gardent leurs valeurs d'avant). Tirage « centré » : les formes moyennes sont plus fréquentes que les extrêmes.
 */
export interface RandomProfile {
  readonly seed: number;
  readonly face: RandomFace;
  readonly skull: SkullParams;
  readonly skin: string;
  readonly hair: string;
  /** Trace de la dérivation (indice céphalique, variation libre par axe) et œil de la face tel que le profil le lit. */
  readonly derivation: Derivation;
  readonly eye: ProfileEyeData;
}

export function generateRandomProfile(seed: number, options: RandomFaceOptions & { hair?: SkullParams['hair'] } = {}): RandomProfile {
  const { hair: hairStyle, ...faceOpts } = options;
  const face = generateRandomFace(seed, { structure: true, ...faceOpts });
  const rnd = mulberry32((seed ^ 0x5c011) >>> 0);
  const u = (lo: number, hi: number): number => lo + (hi - lo) * ((rnd() + rnd()) / 2);
  // Ordre des tirages INCHANGÉ ; les valeurs des axes dérivés ne servent plus que de variation libre (ramenée à [-1, 1]).
  const r01 = (v: number, lo: number, hi: number): number => (2 * (v - lo)) / (hi - lo) - 1;
  const raw = {
    length: u(-0.8, 0.8), vaultHeight: u(0.1, 0.9), vaultPeak: u(0.2, 0.8), foreheadSlope: u(0.05, 0.8), frontalBulge: u(0.1, 0.9), browRidge: u(0, 0.9),
    occiput: u(0.1, 0.9), inion: u(0.05, 0.9), scalp: u(0.1, 0.9), maxilla: u(-0.7, 0.7), zygoma: u(0.1, 0.9), neckTilt: u(0.05, 0.85), neckDepth: u(0.1, 0.9),
    lordosis: u(0.1, 0.9), c7: u(0.1, 0.9), trapezius: u(0.1, 0.9), thyroid: u(0, 0.7),
    hair: hairStyle ?? 'auto', napeHairline: u(0.2, 0.9),
  };
  const drawCI = r01(raw.length, -0.8, 0.8);
  const axes: Partial<Record<DerivedAxis, number>> = { vaultHeight: r01(raw.vaultHeight, 0.1, 0.9), frontalBulge: r01(raw.frontalBulge, 0.1, 0.9), foreheadSlope: r01(raw.foreheadSlope, 0.05, 0.8), zygoma: r01(raw.zygoma, 0.1, 0.9), neckDepth: r01(raw.neckDepth, 0.1, 0.9) };
  const { length: _l, vaultHeight: _v, foreheadSlope: _f, frontalBulge: _b, zygoma: _z, neckDepth: _n, ...free } = raw;
  void [_l, _v, _f, _b, _z, _n];
  const derivation = deriveSkull(face.params, face.width / face.height, SkullParams.parse(free), { ci: drawCI, axes });
  const skin = (face.objects[0] as { material: { color: string } }).material.color;
  const hair = face.params.hair.color ?? '#4a3222';
  return { seed, face, skull: derivation.skull, skin, hair, derivation, eye: profileEyeData(face.fits.right, face.height) };
}
