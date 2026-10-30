import { mulberry32 } from '../core/prng';
import { BodyParams, type BodyInput } from './types';

/**
 * Archétypes : points de départ NOMMÉS dans l'espace des 4 axes indépendants (âge, sexe, adiposité, musculature). Ce ne sont pas des catégories
 * du moteur (il n'en connaît aucune) : seulement des raccourcis de test et de galerie. `generateBody` ajoute une variation graine-déterministe
 * de la charpente et des membres autour de l'archétype, sans jamais franchir les bornes du schéma.
 */
export const ARCHETYPES = {
  baby: { age: 0.6, sex: 0, adiposity: 0.55, muscularity: 0.1 },
  toddler: { age: 3, sex: 0, adiposity: 0.4, muscularity: 0.15 },
  child: { age: 8, sex: 0, adiposity: 0.25, muscularity: 0.2 },
  teenFemale: { age: 15, sex: -1, adiposity: 0.25, muscularity: 0.25 },
  teenMale: { age: 15, sex: 1, adiposity: 0.2, muscularity: 0.3 },
  adultFemale: { age: 28, sex: -1, adiposity: 0.3, muscularity: 0.3 },
  adultMale: { age: 28, sex: 1, adiposity: 0.25, muscularity: 0.4 },
  thin: { age: 28, sex: 1, adiposity: 0.02, muscularity: 0.08 },
  obese: { age: 38, sex: 1, adiposity: 0.95, muscularity: 0.2 },
  muscular: { age: 28, sex: 1, adiposity: 0.12, muscularity: 0.7 },
  veryMuscular: { age: 28, sex: 1, adiposity: 0.05, muscularity: 1 },
  elderFemale: { age: 78, sex: -1, adiposity: 0.35, muscularity: 0.15 },
  elderMale: { age: 78, sex: 1, adiposity: 0.3, muscularity: 0.2 },
} as const satisfies Record<string, BodyInput>;
export type ArchetypeName = keyof typeof ARCHETYPES;
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as ArchetypeName[];

export function generateBody(seed: number, archetype: ArchetypeName, spread = 0.35): BodyParams {
  const r = mulberry32(seed);
  const j = (): number => (r() * 2 - 1) * spread;
  const base = ARCHETYPES[archetype];
  const arm = (): object => ({ abduction: 6 + r() * 16, elbowFlex: 4 + r() * 14, pronation: -0.55 - r() * 0.45, spread: 0.15 + r() * 0.3 });
  return BodyParams.parse({
    ...base,
    frame: { shoulderWidth: j(), clavicleSlope: j(), trapezius: j(), chest: j(), waist: j(), hip: j(), torsoLength: j() * 0.5 },
    limbs: { upperArm: j(), forearm: j(), hand: j(), palmWidth: j(), armThickness: j(), wristThickness: j(), thumb: j() },
    fingers: [j(), j(), j(), j(), j()],
    breast: { volume: 0.3 + r() * 0.5, ptosis: r() * 0.5, spacing: j(), projection: 0.3 + r() * 0.5 },
    pose: { left: arm(), right: arm() },
  });
}
