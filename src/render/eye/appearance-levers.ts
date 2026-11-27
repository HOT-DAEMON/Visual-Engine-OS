import type { EyeSpec } from '../../schema';

/**
 * LEVIERS D'APPARENCE DE L'ŒIL (passe 20). Le contrat d'apparence partagé (`schema/appearance.ts`, même contrat que la peau et les cheveux) exposait sur l'œil six réglages
 * qu'AUCUN code de l'œil ne lisait (audit : `scripts/lib/eye-param-audit.ts`, 6 orphelins sur 268 paramètres) : `opacity`, `reflection.intensity`, `reflection.size`,
 * `shading.mode`, `shading.castShadow`, `shading.highlightBand`. Ils sont lus ICI, une seule fois, avec les MÊMES conventions que `skin/shading.ts` (0,5 = neutre pour
 * `reflection.*`, mode `cel` = bords durs) ; l'œil dont l'apparence est `null` ou laissée aux valeurs par défaut a des leviers NEUTRES : rendu identique à l'octet.
 *
 * Lus sur l'œil BRUT (avant `flattenEye`, qui met `appearance` à null pour les finis `flat` / `cel` : ces finis retirent les effets du moteur d'apparence, pas ces leviers).
 */
export interface EyeLevers {
  /** Opacité globale de l'œil (1 = opaque). */
  readonly opacity: number;
  /** Facteur sur l'opacité des reflets : 2 × `reflection.intensity` (0,5 = neutre), comme la peau. */
  readonly reflectionGain: number;
  /** Facteur sur la taille des reflets : 0,6 + 0,8 × `reflection.size` (0,5 = neutre), comme la peau. */
  readonly reflectionScale: number;
  /** `shading.mode === 'cel'` : le fini `shaded` devient `cel` (voir `resolveEye`). */
  readonly cel: boolean;
  /** 0 = ombre des paupières inchangée ; 1 = profondeur et opacité × 1,5. */
  readonly castShadow: number;
  /** 0 = aucune bande ; largeur du croissant de lumière sur l'iris, en part du rayon : 0,32 × valeur. */
  readonly highlightBand: number;
}

export const NEUTRAL_LEVERS: EyeLevers = { opacity: 1, reflectionGain: 1, reflectionScale: 1, cel: false, castShadow: 0, highlightBand: 0 };

export function eyeLevers(eye: Pick<EyeSpec, 'appearance'>): EyeLevers {
  const a = eye.appearance;
  if (!a) return NEUTRAL_LEVERS;
  return {
    opacity: a.opacity,
    reflectionGain: 2 * a.reflection.intensity,
    reflectionScale: 0.6 + 0.8 * a.reflection.size,
    cel: a.shading.mode === 'cel',
    castShadow: a.shading.castShadow,
    highlightBand: a.shading.highlightBand,
  };
}

/** Fini EFFECTIF : `shaded` + `shading.mode: 'cel'` = fini `cel` (aplats, ombre portée dure) ; un fini explicite (`flat`, `cel`) n'est jamais écrasé. */
export const effectiveFinish = (eye: Pick<EyeSpec, 'finish' | 'appearance'>): EyeSpec['finish'] => (eye.finish === 'shaded' && eyeLevers(eye).cel ? 'cel' : eye.finish);
