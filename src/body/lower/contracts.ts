import type { BodyContract } from '../contracts';

/**
 * CONTRATS DU BAS DU CORPS : même principe que `../contracts.ts` (le test PERTURBE chaque paramètre et exige que seuls changent des composants en
 * aval d'un lecteur déclaré). Les axes du haut du corps (âge, sexe, adiposité, musculature, hanche, longueur du tronc) arrivent par le cadre
 * du corps : ils sont déclarés en lecture ici, une seule fois (`CORE`).
 */
const CORE = ['age', 'sex', 'adiposity', 'muscularity', 'frame.hip', 'frame.torsoLength'] as const;
const THIGH = ['quadriceps', 'rectus-femoris', 'vastus-', 'sartorius', 'adductor', 'gracilis', 'pectineus', 'tensor-fasciae', 'iliotibial', 'hamstrings', 'biceps-femoris', 'semi', 'bone.femur', 'knee.'];
const SHIN = ['tibialis', 'extensor-', 'peroneus', 'gastrocnemius', 'soleus', 'flexor-', 'bone.tibia', 'bone.fibula', 'knee.', 'shin.', 'ankle.'];
const side = (s: 'left' | 'right', ...k: string[]): string[] => k.map((x) => `pose.${s}.${x}`);
const leg = (S: 'L' | 'R', s: 'left' | 'right'): Record<string, BodyContract> => ({
  [`thigh.${S}`]: { needs: ['pelvis'], reads: [...CORE, 'limbs.thigh', 'limbs.thighGirth', 'limbs.kneeWidth', ...side(s, 'abduction')], provides: [`leg.thigh.${S}`, ...THIGH] },
  [`shin.${S}`]: { needs: [`thigh.${S}`], reads: [...CORE, 'limbs.shin', 'limbs.calfGirth', 'limbs.ankleThickness', ...side(s, 'kneeFlex')], provides: [`leg.shin.${S}`, ...SHIN] },
  [`foot.${S}`]: { needs: [`shin.${S}`], reads: [...CORE, 'limbs.foot', 'toes', ...side(s, 'footTurnout', 'toeSpread', 'toeCurl')], provides: ['foot.', 'toe.'] },
});
export const LOWER_CONTRACTS: Readonly<Record<string, BodyContract>> = {
  pelvis: { needs: [], reads: CORE, provides: ['pelvis.', 'gluteus-'] },
  ...leg('L', 'left'),
  ...leg('R', 'right'),
};
