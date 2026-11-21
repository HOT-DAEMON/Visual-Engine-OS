import { mulberry32 } from '../core/prng';
import { Canthi } from '../schema/eye-canthi-fold';
import { Shape } from '../schema/eye-shape';
import { verifyEye } from '../verify/eye';
import { STYLES, WIDTH, buildExtraEye, candidates, dist, existingVectors, extraEyeRecipes, profileVector, type Cand, type EyeRecipe } from './eye-gallery-ext';
import { PHOTO_IRIS_FAMILIES, photoIrisFamily, type PhotoIris, type PhotoIrisFamily } from './eye-iris-families-photo';
import type { EyeInput } from './random-eye-helpers';

/**
 * SECONDE GALERIE (passe 9) : 100 formes d'yeux EN PLUS des 48 de `scripts/gallery.ts` ET des 100 de `eye-gallery-ext.ts` (aucun œil existant n'est modifié ni remplacé).
 * Même mécanisme que la première (échantillonnage du plus éloigné sur les profils d'enveloppe des 12 styles, `candidates` partagé), mais :
 *   - les distances sont calculées contre les 148 formes déjà existantes (seuil `NEW2_MIN_DIST`, mesuré et exposé par `distinctness2`) ;
 *   - un flux pseudo-aléatoire distinct (graine 0x7e4a9c21) : les candidats ne sont pas ceux de la première galerie ;
 *   - ~70 % des yeux reçoivent une des 4 familles d'iris « photo » (réfs 03, 05, 06, 09 : `eye-iris-families-photo.ts`), les autres gardent l'iris naturel tiré par la graine.
 * Le rendu passe par `buildExtraEye` (même calibration du rayon d'iris sur l'ouverture réelle, mêmes cils, mêmes vérifications) : un seul moteur.
 */
export const EXTRA2_COUNT = 100;
/** Distance minimale (profils, largeur = 1) à n'importe quelle forme existante ; en dessous un style est SATURÉ et cède ses places. Plus bas que 0,02 (galerie 1) : 148 formes occupent déjà l'espace. */
export const NEW2_MIN_DIST = 0.012;
const PHOTO_SHARE = 0.7;
const ROUNDISH = ['round', 'chibi', 'circle'];

export interface Eye2Recipe extends EyeRecipe { readonly irisFamily: PhotoIrisFamily | null; }

export const vectorOf = (r: EyeRecipe): number[] =>
  profileVector(Shape.parse({ width: WIDTH, height: WIDTH * r.aspect, tiltDeg: r.tiltDeg, upperFraction: r.upperFraction, openness: r.openness, style: r.style, ...(r.lowerPeak === undefined ? {} : { lowerPeak: r.lowerPeak }) }), Canthi.parse({ inner: { roundness: r.innerRoundness, caruncle: r.caruncle }, outer: { roundness: r.outerRoundness } }));

/**
 * Sélection de `count` formes d'enveloppe EN PLUS de `taken` (profils déjà occupés) : échantillonnage du plus éloigné par style (flux `streamSeed`), un style saturé
 * (distance minimale < `minDist`) cède ses places, entrelacement final sans deux enveloppes identiques consécutives. Partagé par les galeries 2 et 3.
 */
export function selectRecipes(taken: number[][], streamSeed: number, count: number, minDist: number, pool: (style: (typeof STYLES)[number], rnd: () => number) => Cand[] = candidates): Omit<EyeRecipe, 'index' | 'seed'>[] {
  const pools = new Map<string, Cand[]>(STYLES.map((s, i) => [s, pool(s, mulberry32((streamSeed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0))]));
  const saturated = new Set<string>();
  const picked: Omit<EyeRecipe, 'index' | 'seed'>[] = [];
  while (picked.length < count) {
    let placed = false;
    for (const s of STYLES) {
      if (picked.length >= count) break;
      if (saturated.has(s)) continue;
      const pool = pools.get(s) as Cand[];
      let best = -1; let bestD = -1;
      pool.forEach((c, k) => { const m = Math.min(...taken.map((t) => dist(c.d, t))); if (m > bestD) { bestD = m; best = k; } });
      if (best < 0 || bestD < minDist) { saturated.add(s); continue; }
      const c = pool.splice(best, 1)[0] as Cand; taken.push([...c.d]);
      const { d: _d, ...rest } = c; picked.push({ ...rest, nearest: bestD }); placed = true;
    }
    if (!placed) break;
  }
  // Entrelacement identique à la galerie 1 : jamais deux enveloppes identiques consécutives (glouton, déterministe).
  const left = new Map<string, Omit<EyeRecipe, 'index' | 'seed'>[]>(STYLES.map((s) => [s, picked.filter((r) => r.style === s)]));
  const woven: Omit<EyeRecipe, 'index' | 'seed'>[] = [];
  while (woven.length < picked.length) {
    const prev = woven[woven.length - 1]?.style;
    const pick = STYLES.filter((s) => s !== prev && (left.get(s)?.length ?? 0) > 0).sort((a, b) => (left.get(b)?.length ?? 0) - (left.get(a)?.length ?? 0))[0];
    if (!pick) break;
    woven.push((left.get(pick) as Omit<EyeRecipe, 'index' | 'seed'>[]).shift() as Omit<EyeRecipe, 'index' | 'seed'>);
  }
  return woven.length === picked.length ? woven : picked;
}

let memo: Eye2Recipe[] | null = null;
export function extra2Recipes(): readonly Eye2Recipe[] {
  if (memo) return memo;
  const order = selectRecipes([...existingVectors(), ...extraEyeRecipes().map(vectorOf)], 0x7e4a9c21, EXTRA2_COUNT, NEW2_MIN_DIST);
  memo = order.map((r, i) => {
    const seed = 9000 + i * 131; const rnd = mulberry32(seed ^ 0x3c6ef372);   // flux À PART : la famille d'iris ne décale aucun autre tirage
    const irisFamily = rnd() < PHOTO_SHARE ? (PHOTO_IRIS_FAMILIES[Math.floor(rnd() * PHOTO_IRIS_FAMILIES.length)] as PhotoIrisFamily) : null;
    return { ...r, index: i, seed, irisFamily };
  });
  return memo;
}

/** Remplace l'iris par un iris « photo » déjà construit (couches, détail, lueur, limbe, fibres, pupille à aspect mesuré, reflets) ; le rayon est recalibré APRÈS (override appliqué avant la calibration). Partagé avec la galerie 3 (familles photo 2). */
export function applyIrisPreset(e: EyeInput, p: PhotoIris, style: string, simple: boolean): EyeInput {
  const keepAspect = ROUNDISH.includes(style) || p.irisAspect === null;
  return {
    ...e, archetype: null, finish: 'shaded',   // dégradés, fibres et lueur : un fini `flat` (encre) les retirerait
    iris: { ...e.iris, ...(p.base ? { material: { ...(e.iris as { material?: object } | undefined)?.material, base: { type: 'radial', stops: p.base } } } : {}), layers: p.layers, detail: p.detail, limbalRing: p.limbalRing, fibers: p.fibers, glow: p.glow, ...(p.vibrance === undefined ? {} : { vibrance: p.vibrance }), ...(keepAspect ? {} : { aspect: p.irisAspect }) },
    pupil: { ...e.pupil, shape: p.pupil.shape, size: p.pupil.size, deform: { ...(e.pupil?.deform ?? {}), squash: p.pupil.squash } },
    highlights: { list: simple ? p.highlights.slice(0, 2) : p.highlights },
  } as EyeInput;
}

/** Remplace l'iris par la famille « photo » (réfs 03, 05, 06, 09). */
export function applyPhotoIris(e: EyeInput, family: PhotoIrisFamily, style: string, seed: number, simple: boolean): EyeInput {
  return applyIrisPreset(e, photoIrisFamily(family, mulberry32(seed ^ 0x2545f491)), style, simple);
}

export function generateExtra2Eye(index: number, expression?: EyeInput['expression']): EyeInput {
  const rc = extra2Recipes()[index];
  if (!rc) throw new Error(`generateExtra2Eye: index ${index} hors 0..${EXTRA2_COUNT - 1}`);
  const build = (attempt: number): EyeInput => {
    const eye = buildExtraEye(rc, attempt, rc.irisFamily ? (e) => applyPhotoIris(e, rc.irisFamily as PhotoIrisFamily, rc.style, rc.seed, attempt >= 2) : undefined);
    return { ...eye, id: `extra2-${rc.index}` } as EyeInput;
  };
  let eye = build(0);
  for (let attempt = 1; attempt <= 6 && !verifyEye(eye as never).ok; attempt++) eye = build(attempt);
  return expression ? ({ ...eye, expression } as EyeInput) : eye;
}

/** Distances minimales (largeur = 1) : aux 48 + 100 yeux existants, et entre les 100 nouveaux ; effectif par style et par famille d'iris. */
export function distinctness2(): { readonly minToExisting: number; readonly minAmongNew: number; readonly byStyle: Record<string, number>; readonly byFamily: Record<string, number> } {
  const ex = [...existingVectors(), ...extraEyeRecipes().map(vectorOf)]; const rc = extra2Recipes(); const vs = rc.map(vectorOf);
  let minToExisting = Infinity; let minAmongNew = Infinity;
  vs.forEach((v, i) => { for (const e of ex) minToExisting = Math.min(minToExisting, dist(v, e)); for (let j = i + 1; j < vs.length; j++) minAmongNew = Math.min(minAmongNew, dist(v, vs[j] as number[])); });
  const byStyle: Record<string, number> = {}; const byFamily: Record<string, number> = {};
  for (const r of rc) { byStyle[r.style] = (byStyle[r.style] ?? 0) + 1; byFamily[r.irisFamily ?? 'naturel'] = (byFamily[r.irisFamily ?? 'naturel'] ?? 0) + 1; }
  return { minToExisting, minAmongNew, byStyle, byFamily };
}
