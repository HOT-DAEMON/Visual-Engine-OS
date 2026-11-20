import { mulberry32 } from '../core/prng';
import { verifyEye } from '../verify/eye';
import { buildExtraEye, dist, existingVectorsTrue, extraEyeRecipes, type EyeRecipe } from './eye-gallery-ext';
import { applyIrisPreset, extra2Recipes, selectRecipes, vectorOf } from './eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, photoIrisFamily2, type Photo2IrisFamily } from './eye-iris-families-photo2';
import type { EyeInput } from './random-eye-helpers';

/**
 * TROISIÈME GALERIE (passe 10) : 100 formes d'yeux EN PLUS des 48 + 100 + 100 existantes (aucun œil existant n'est modifié). Même sélection que la galerie 2
 * (`selectRecipes` partagé : échantillonnage du plus éloigné par style, un style saturé cède ses places) contre les 248 profils déjà occupés, flux distinct (0x51a7e3d9) ;
 * ~80 % des yeux reçoivent une des 5 familles d'iris « photo 2 » (réfs 04, 07, 08, 10 : `eye-iris-families-photo2.ts`), les autres gardent l'iris naturel.
 * Le rendu passe par `buildExtraEye` + `applyIrisPreset` : un seul moteur, un seul chemin de calibration du rayon d'iris.
 */
export const EXTRA3_COUNT = 100;
/** Distance minimale (profils, largeur = 1) aux 248 formes existantes ; l'espace est plus occupé qu'en galerie 2 (0,012). */
export const NEW3_MIN_DIST = 0.009;
const PHOTO2_SHARE = 0.8;

export interface Eye3Recipe extends EyeRecipe { readonly irisFamily: Photo2IrisFamily | null; }

let memo: Eye3Recipe[] | null = null;
export function extra3Recipes(): readonly Eye3Recipe[] {
  if (memo) return memo;
  const taken: number[][] = [...existingVectorsTrue(), ...extraEyeRecipes().map(vectorOf), ...extra2Recipes().map(vectorOf)];
  const order = selectRecipes(taken, 0x51a7e3d9, EXTRA3_COUNT, NEW3_MIN_DIST);
  memo = order.map((r, i) => {
    const seed = 20000 + i * 151; const rnd = mulberry32(seed ^ 0x6a09e667);   // flux À PART : la famille d'iris ne décale aucun autre tirage
    const irisFamily = rnd() < PHOTO2_SHARE ? (PHOTO2_IRIS_FAMILIES[Math.floor(rnd() * PHOTO2_IRIS_FAMILIES.length)] as Photo2IrisFamily) : null;
    return { ...r, index: i, seed, irisFamily };
  });
  return memo;
}

export function generateExtra3Eye(index: number, expression?: EyeInput['expression']): EyeInput {
  const rc = extra3Recipes()[index];
  if (!rc) throw new Error(`generateExtra3Eye: index ${index} hors 0..${extra3Recipes().length - 1}`);
  const build = (attempt: number): EyeInput => {
    const eye = buildExtraEye(rc, attempt, rc.irisFamily ? (e) => applyIrisPreset(e, photoIrisFamily2(rc.irisFamily as Photo2IrisFamily, mulberry32(rc.seed ^ 0x2545f491)), rc.style, attempt >= 2) : undefined);
    return { ...eye, id: `extra3-${rc.index}` } as EyeInput;
  };
  let eye = build(0);
  for (let attempt = 1; attempt <= 6 && !verifyEye(eye as never).ok; attempt++) eye = build(attempt);
  return expression ? ({ ...eye, expression } as EyeInput) : eye;
}

/** Distances minimales (largeur = 1) : aux 248 yeux existants, et entre les nouveaux ; effectif par style et par famille d'iris. */
export function distinctness3(): { readonly count: number; readonly minToExisting: number; readonly minAmongNew: number; readonly byStyle: Record<string, number>; readonly byFamily: Record<string, number> } {
  const ex = [...existingVectorsTrue(), ...extraEyeRecipes().map(vectorOf), ...extra2Recipes().map(vectorOf)]; const rc = extra3Recipes(); const vs = rc.map(vectorOf);
  let minToExisting = Infinity; let minAmongNew = Infinity;
  vs.forEach((v, i) => { for (const e of ex) minToExisting = Math.min(minToExisting, dist(v, e)); for (let j = i + 1; j < vs.length; j++) minAmongNew = Math.min(minAmongNew, dist(v, vs[j] as number[])); });
  const byStyle: Record<string, number> = {}; const byFamily: Record<string, number> = {};
  for (const r of rc) { byStyle[r.style] = (byStyle[r.style] ?? 0) + 1; byFamily[r.irisFamily ?? 'naturel'] = (byFamily[r.irisFamily ?? 'naturel'] ?? 0) + 1; }
  return { count: rc.length, minToExisting, minAmongNew, byStyle, byFamily };
}
