import { EyeSpec } from '../schema';

/**
 * FAMILLES DE CILS tirées des références 12, 13, 16 (traits noirs sur blanc), échantillonnées par scripts/eye-refs/extract_lashes.py (squelette de chaque cil : longueur, courbure, touffes,
 * nombre, effilement) -> references/eyes/measures-lashes.json. Ce ne sont PAS de nouveaux moteurs : chaque famille ne fait que régler les paramètres du moteur de cils existant
 * (src/schema/eye-lashes.ts, src/geometry/eye/lashes.ts, lash-extras.ts).
 *
 * Provenance de chaque valeur, annotée « M » (mesurée sur les pixels), « I » (interprétée sur les planches : l'orientation interne/externe déduite des mesures est encore peu fiable,
 * voir docs/EYES-LASHES.md) ou « C » (conversion d'unité : les mesures sont en fraction de la LARGEUR de l'œil, le moteur en fraction de sa HAUTEUR ; rapport largeur/hauteur ≈ 2 dans les références).
 */
export type LashFamilyId = 'plume' | 'touffes' | 'frange-dense' | 'fin-feminin' | 'aile-liner' | 'rond-kawaii';

type Patch = Record<string, unknown>;
/** Encre des cils : noir bleuté opaque comme dans les références (les cils héritaient de la teinte de paupière, pâle et translucide à l'image). */
const INK = { material: { base: { type: 'solid', color: '#120e18' }, roughness: 0.6 }, opacity: 1, gloss: 0, colorVariation: 0 } as const;
export interface LashFamily { readonly id: LashFamilyId; readonly label: string; readonly sources: readonly string[]; readonly upper: Patch; readonly lower: Patch }

export const LASH_FAMILIES: Readonly<Record<LashFamilyId, LashFamily>> = {
  // Peu de cils, longs et balayés vers l'extérieur, aile finale recourbée. 13-03, 13-06, 13-07, 13-10 : longueur max 0,5 à 0,7 de la largeur (M) ; 3 à 5 cils du haut (M).
  plume: {
    id: 'plume', label: 'Plumes / ailes balayées', sources: ['13-03', '13-06', '13-07', '13-10'],
    upper: { count: 7, length: 0.3, thickness: 1.2, curl: 0.78, sweep: 38, tipSharpness: 0.8, arch: { peak: 0.86, width: 0.28, strength: 0.85 }, outerLength: 1.3, outerLift: 0.45, lengthVariation: 0.3, orientationVariation: 3,
      flick: { count: 3, length: 0.8, reach: 0.2, liftDeg: 26, curl: 0.82 } },
    lower: { count: 3, length: 0.07, thickness: 0.3, tipSharpness: 0.8 },
  },
  // Cils courts réunis en touffes à pointes, larges à la base (13-00, 13-01, 13-11, 13-05) : 4 à 5 pointes, hauteur moyenne 0,07 à 0,12 de la largeur (M), effilement 0,5 à 0,63 (M).
  touffes: {
    id: 'touffes', label: 'Touffes à pointes', sources: ['13-00', '13-01', '13-11'],
    upper: { count: 12, length: 0.26, thickness: 1.4, curl: 0.5, sweep: 22, tipSharpness: 0.55, clump: 0.85, clumpSize: 3, arch: { peak: 0.74, width: 0.4, strength: 0.5 }, positionDispersion: 0.45, orientationVariation: 3, outerLength: 0.4 },
    lower: { count: 3, length: 0.07, thickness: 0.35 },
  },
  // Frange continue de nombreux cils fins, plus longs à l'extérieur : 13-05 (11 pointes, rapport externe/interne ~1,9 (M)) ; 16-26 et 16-28 (frange haut et bas, vue).
  'frange-dense': {
    id: 'frange-dense', label: 'Frange dense', sources: ['13-05', '16-26', '16-28'],
    upper: { count: 44, length: 0.2, thickness: 0.5, curl: 0.55, sweep: 32, tipSharpness: 0.88, arch: { peak: 0.8, width: 0.5, strength: 0.55 }, lengthVariation: 0.35, orientationVariation: 9, positionDispersion: 0.5, outerLength: 0.9 },
    lower: { count: 18, length: 0.1, thickness: 0.22, tipSharpness: 0.85, orientationVariation: 8 },
  },
  // Style féminin fin : peu de petits traits très ouverts en éventail, aile courte au canthus externe. 12-02…12-11 : 2 à 5 traits, 0,06 à 0,1 de la largeur (M) ; 16-12, 16-13.
  'fin-feminin': {
    id: 'fin-feminin', label: 'Fin, style féminin', sources: ['12-02', '12-03', '12-08', '12-09', '16-12', '16-13'],
    upper: { count: 9, length: 0.24, thickness: 0.9, curl: 0.72, sweep: 46, tipSharpness: 0.92, arch: { peak: 0.8, width: 0.35, strength: 0.6 }, outerLength: 0.7, outerLift: 0.2, orientationVariation: 4,
      flick: { count: 2, length: 0.55, reach: 0.14, liftDeg: 38, curl: 0.7 } },
    lower: { count: 2, length: 0.06, thickness: 0.25, tipSharpness: 0.9 },
  },
  // Quasi aucun cil visible, mais une aile épaisse de liner au canthus externe (réf. 15 ; 12-06, 12-07, 13-04) : 1 à 3 cils (M).
  'aile-liner': {
    id: 'aile-liner', label: 'Aile de liner', sources: ['12-06', '12-07', '13-04', '15'],
    upper: { count: 4, length: 0.16, thickness: 1.5, curl: 0.2, sweep: 14, tipSharpness: 0.85, arch: { peak: 0.9, width: 0.3, strength: 0.7 }, outerLength: 0.5,
      flick: { count: 2, length: 0.7, reach: 0.12, liftDeg: 18, curl: 0.25 } },
    lower: { count: 0 },
  },
  // Œil rond « kawaii » : une demi-douzaine de petits cils recourbés en éventail régulier autour du haut du globe (16-17, 16-18, 16-30, 16-31) : 2 à 6 cils du haut (M), longueur 0,08 à 0,13 de la largeur (M).
  'rond-kawaii': {
    id: 'rond-kawaii', label: 'Rond kawaii', sources: ['16-17', '16-18', '16-30', '16-31'],
    upper: { count: 7, length: 0.2, thickness: 0.95, curl: 0.82, sweep: 56, tipSharpness: 0.7, arch: { peak: 0.5, width: 0.85, strength: 0.2 }, outerLength: 0.2, orientationVariation: 2, lengthVariation: 0.1, positionDispersion: 0.1 },
    lower: { count: 0 },
  },
};

export const LASH_FAMILY_IDS = Object.keys(LASH_FAMILIES) as LashFamilyId[];

/** Applique une famille de cils à un œil (spec brute) : remplace seulement les champs que la famille règle, le reste des cils (couleur, matériau, opacité) de l'œil est conservé. */
export function applyLashFamily<T extends Record<string, unknown>>(eye: T, id: LashFamilyId): T {
  const fam = LASH_FAMILIES[id];
  const cur = ((eye as { lashes?: { upper?: Patch; lower?: Patch } }).lashes ?? {}) as { upper?: Patch; lower?: Patch };
  const out = { ...eye, lashes: { upper: { ...(cur.upper ?? {}), ...INK, ...fam.upper }, lower: { ...(cur.lower ?? {}), ...INK, opacity: 0.9, ...fam.lower } } } as T;
  EyeSpec.parse(out);   // échoue tout de suite si une famille sort du schéma
  return out;
}
