import { mulberry32 } from '../core/prng';
import { openingGeometry, openingProfile } from '../geometry/eye';
import { irisRadii } from '../render/eye/helpers';
import { resolveEye } from '../render/eye/eye';
import { EyeSpec } from '../schema';
import { Canthi } from '../schema/eye-canthi-fold';
import { Shape } from '../schema/eye-shape';
import { checkEyeEnvelope } from '../verify/eye-envelope';
import { verifyEye } from '../verify/eye';
import { generateRandomEye } from './random-eye';
import { REF_FITS } from './eye-ref-fits';
import { LASH_FAMILY_IDS, applyLashFamily, type LashFamilyId } from './eye-lash-families';
import { INK_IRIS_OVER_HEIGHT, SPRITE_IRIS_OVER_HEIGHT, applyLook, inkLines, lookForRef } from './eye-ref-looks';
import { IRIS_FAMILIES, PUPIL_OVER_IRIS, ROUND_IRIS_ASPECT, irisFamily } from './eye-iris-families';
import type { EyeInput } from './random-eye-helpers';

/**
 * GALERIE ÉTENDUE : 100 formes d'yeux EN PLUS des 48 de `scripts/gallery.ts` (seeds 1000 + i·101), toutes issues des 12 enveloppes développées
 * (la galerie d'origine n'en exploitait que 4 : almond / round / sharp / drooping).
 *
 * Distinction PROUVÉE, pas supposée : chaque forme est choisie par échantillonnage du plus éloigné (farthest-point) parmi un lot de candidats,
 * la distance étant l'écart quadratique moyen des profils d'enveloppe (haut + bas, unités de largeur — `openingProfile`) + un terme d'inclinaison ;
 * le lot est tiré avec un quota par style (8 par style, +1 pour 4 styles) et la distance MINIMALE aux 48 yeux existants et entre les 100 est
 * exposée (`distinctness`), vérifiée par tests/eye-gallery-ext.test.ts. Aucun œil n'est retouché à la main : tout vient de la graine et des recettes.
 *
 * Les traits hors enveloppe (iris, pupille, cils…) viennent de `generateRandomEye` ; l'enveloppe, les canthi, le pli et la taille de l'iris sont
 * imposés par la recette (rayon d'iris ≈ 0,5 × openness : diamètre ≈ hauteur d'ouverture, mesuré sur references/eyes), pupille 0,2–0,34 (réfs : 0,13–0,28).
 */
export type EyeStyle = EyeInput['shape'] extends infer S ? (S extends { style?: infer T } ? NonNullable<T> : never) : never;

export const EXTRA_EYE_COUNT = 100;
export const EXISTING_GALLERY_COUNT = 48;
export const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
/** Les 4 styles qui reçoivent une forme de plus (100 = 12 × 8 + 4) : ceux dont l'espace de paramètres produit le plus de silhouettes distinctes. */
/** Distance minimale (profils, largeur = 1) d'une silhouette de référence ajustée à toutes les formes déjà retenues ; en dessous, la silhouette est écartée (doublon d'une forme existante). */
const REF_MIN_DIST = 0.02;
const EXTRA_QUOTA: readonly string[] = ['chibi', 'angular', 'triangle', 'rounded_rect'];
const CANDIDATES_PER_STYLE = 320;
export const WIDTH = 240;
/** Distance minimale entre deux des 100 formes (largeur = 1), comme pour les 48 existantes. Un style dont le meilleur candidat restant est plus proche d'une forme déjà retenue est SATURÉ : il cède ses places (voir `extraEyeRecipes`). Mesuré avant : 0,0089 (diamond, diamond_v2) ; agrandir le pool de candidats ne change rien (320, 900, 2 000, 5 000 : 0,0095–0,0121), c'est l'espace de paramètres de ces styles qui est étroit. */
export const NEW_MIN_DIST = 0.02;
/** Diamètre vertical de l'iris / hauteur d'ouverture (mesuré sur references/eyes : rayon/hauteur 0,49–0,54 -> diamètre 0,98–1,08). */
const IRIS_OVER_HEIGHT = 1.02;

export interface EyeRecipe {
  readonly index: number;
  readonly style: (typeof STYLES)[number];
  readonly seed: number;
  /** Rapport hauteur nominale / largeur. */
  readonly aspect: number;
  readonly tiltDeg: number;
  readonly upperFraction: number;
  readonly openness: number;
  readonly innerRoundness: number;
  readonly outerRoundness: number;
  readonly caruncle: number;
  readonly foldAmount: number;
  /** Distance au plus proche voisin (parmi les 48 existants et les formes déjà choisies) au moment du choix. */
  readonly nearest: number;
  /** Identifiant de la silhouette mesurée (réfs 13 / 15 / 17) dont la recette est ajustée ; absent pour les formes tirées par échantillonnage du plus éloigné. */
  readonly ref?: string;
}

export interface Cand extends Omit<EyeRecipe, 'index' | 'seed' | 'nearest'> { readonly d: readonly number[]; }

export const profileVector = (shape: ReturnType<typeof Shape.parse>, canthi: ReturnType<typeof Canthi.parse>): number[] => {
  const p = openingProfile(openingGeometry(shape, canthi));
  return [...p.upper, ...p.lower, (p.tiltDeg * Math.PI) / 180 * 0.4];
};
export const dist = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - (b[i] as number)) ** 2, 0) / a.length);

export const existingVectors = (): number[][] =>
  Array.from({ length: EXISTING_GALLERY_COUNT }, (_, i) => {
    const e = generateRandomEye(1000 + i * 101, { expression: { kind: 'neutral', intensity: 1 } });
    return profileVector(Shape.parse({ outerSide: 'right', ...e.shape }), Canthi.parse(e.canthi ?? {}));
  });

export function candidates(style: (typeof STYLES)[number], rnd: () => number): Cand[] {
  const out: Cand[] = [];
  const r = (a: number, b: number): number => a + rnd() * (b - a);
  // Les deux losanges n'ont que 3 degrés de liberté (aspect, inclinaison, ouverture) : sur la plage étroite ils saturent à 3-5 formes distinctes ; plage élargie pour eux seuls (les autres styles gardent leur plage : portée des cils bornée).
  const wide = style === 'diamond' || style === 'diamond_v2';
  for (let n = 0; n < CANDIDATES_PER_STYLE * 3 && out.length < CANDIDATES_PER_STYLE; n++) {
    const c = { style, aspect: wide ? r(0.40, 0.80) : r(0.44, 0.70), tiltDeg: wide ? r(-8, 16) : r(-5, 14), upperFraction: r(0.52, 0.72), openness: r(0.82, 1.1), innerRoundness: r(0.05, 0.9), outerRoundness: r(0.05, 0.9), caruncle: r(0.2, 0.8), foldAmount: rnd() < 0.35 ? r(0.3, 1) : 0 };
    const shape = Shape.parse({ width: WIDTH, height: WIDTH * c.aspect, tiltDeg: c.tiltDeg, upperFraction: c.upperFraction, openness: c.openness, style });
    const canthi = Canthi.parse({ inner: { roundness: c.innerRoundness, caruncle: c.caruncle }, outer: { roundness: c.outerRoundness } });
    const g = openingGeometry(shape, canthi);
    if (checkEyeEnvelope(g, style, 0).some((k) => !k.ok && k.severity === 'error')) continue; // enveloppe géométriquement invalide : écartée
    out.push({ ...c, d: profileVector(shape, canthi) });
  }
  return out;
}

let memo: EyeRecipe[] | null = null;

/** Les 100 recettes (déterministes, mémoïsées). L'ordre est entrelacé par style : la case i et la case i+1 n'ont jamais le même style. */
export function extraEyeRecipes(): readonly EyeRecipe[] {
  if (memo) return memo;
  // Un flux pseudo-aléatoire PAR STYLE (graine = graine globale ^ rang du style) : changer la plage ou le nombre de tirages d'un style ne remélange plus les réservoirs des autres.
  const pools = new Map<string, Cand[]>(STYLES.map((s, i) => [s, candidates(s, mulberry32((0x9e11d00d ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0))]));
  const quota = new Map<string, number>(STYLES.map((s) => [s, 8 + (EXTRA_QUOTA.includes(s) ? 1 : 0)]));
  const taken: number[][] = existingVectors();
  const recipes: EyeRecipe[] = [];
  // 1. Formes MESURÉES : une recette ajustée par silhouette tracée sur les réfs 13 / 15 / 17 (scripts/eye-refs/fit-recipes.ts), écartée si elle double une forme déjà retenue.
  for (const f of REF_FITS) {
    const style = f.style as (typeof STYLES)[number];
    const d = profileVector(Shape.parse({ width: WIDTH, height: WIDTH * f.aspect, tiltDeg: f.tiltDeg, upperFraction: f.upperFraction, openness: f.openness, style }), Canthi.parse({ inner: { roundness: f.innerRoundness, caruncle: 0.5 }, outer: { roundness: f.outerRoundness } }));
    const m = Math.min(...taken.map((t) => dist(d, t)));
    if (m < REF_MIN_DIST || (quota.get(style) ?? 0) <= 0) continue;
    taken.push(d); quota.set(style, (quota.get(style) ?? 0) - 1);
    recipes.push({ style, aspect: f.aspect, tiltDeg: f.tiltDeg, upperFraction: f.upperFraction, openness: f.openness, innerRoundness: f.innerRoundness, outerRoundness: f.outerRoundness, caruncle: 0.5, foldAmount: 0, index: recipes.length, seed: 0, nearest: m, ref: f.id });
  }
  // 2. Le reste par échantillonnage du plus éloigné, quotas par style ; un style SATURÉ (meilleur candidat < NEW_MIN_DIST) cède ses places aux autres : mieux vaut 5 diamants distincts que 9 quasi-doublons.
  const saturated = new Set<string>();
  while (recipes.length < EXTRA_EYE_COUNT) {
    let placed = false;
    for (const s of STYLES) {
      if ((quota.get(s) ?? 0) <= 0 || saturated.has(s)) continue;
      const pool = pools.get(s) as Cand[];
      let best = -1; let bestD = -1;
      pool.forEach((c, k) => { const m = Math.min(...taken.map((t) => dist(c.d, t))); if (m > bestD) { bestD = m; best = k; } });
      if (bestD < NEW_MIN_DIST) { saturated.add(s); const free = quota.get(s) ?? 0; quota.set(s, 0); const open = STYLES.filter((o) => !saturated.has(o) && o !== s); const to = open[recipes.length % Math.max(open.length, 1)]; if (to) quota.set(to, (quota.get(to) ?? 0) + free); continue; }
      const c = pool.splice(best, 1)[0] as Cand;
      taken.push([...c.d]);
      quota.set(s, (quota.get(s) ?? 0) - 1);
      const { d: _d, ...rest } = c;
      recipes.push({ ...rest, index: recipes.length, seed: 0, nearest: bestD });
      placed = true;
    }
    if (!placed && !STYLES.some((s) => (quota.get(s) ?? 0) > 0 && !saturated.has(s))) break;
  }
  // 3. Entrelacement : jamais deux enveloppes identiques consécutives. Reorganisation gloutonne et déterministe (on place le style restant le plus nombreux qui diffère du précédent ; égalité : ordre de STYLES),
  //    garantie tant qu'aucun style ne dépasse la moitié des cases ; l'ordre relatif des formes d'un même style est conservé. Puis index et graines définitifs.
  const left = new Map<string, EyeRecipe[]>(STYLES.map((s) => [s, recipes.filter((r) => r.style === s)]));
  const woven: EyeRecipe[] = [];
  while (woven.length < recipes.length) {
    const prev = woven[woven.length - 1]?.style;
    const pick = STYLES.filter((s) => s !== prev && (left.get(s)?.length ?? 0) > 0).sort((a, b) => (left.get(b)?.length ?? 0) - (left.get(a)?.length ?? 0))[0];
    if (!pick) break;
    woven.push((left.get(pick) as EyeRecipe[]).shift() as EyeRecipe);
  }
  if (woven.length === recipes.length) recipes.splice(0, recipes.length, ...woven);
  recipes.forEach((r, i) => { recipes[i] = { ...r, index: i, seed: 5000 + i * 131 }; });
  memo = recipes;
  return recipes;
}

/**
 * L'œil complet de la case `index` (0..99) : traits tirés par la graine, enveloppe/canthi/pli/iris/pupille imposés par la recette.
 * Validé par `verifyEye` ; en cas d'échec d'une règle, nouvelles tentatives DÉTERMINISTES de plus en plus sages (regard nul, iris × 0,92ᵏ, reflets simplifiés).
 */
/** Famille de cils (réfs 12, 13, 16) d'un œil de la galerie, ou null : ~55 % des yeux. Générateur À PART (graine décalée) : n'ajoute aucun tirage aux autres paramètres de la recette. */
export function extraEyeLashFamily(index: number): LashFamilyId | null {
  const rc = extraEyeRecipes()[index];
  if (!rc) throw new Error(`extraEyeLashFamily: index ${index} hors 0..${EXTRA_EYE_COUNT - 1}`);
  return lashFamilyForRecipe(rc);
}
/** Même tirage, à partir de la recette (la seconde galerie, passe 9, a ses propres recettes : l'indice ne désigne pas la même case). */
export function lashFamilyForRecipe(rc: EyeRecipe): LashFamilyId | null {
  const r = mulberry32(rc.seed ^ 0x1a5b2c3d);
  return r() < 0.55 ? (LASH_FAMILY_IDS[Math.floor(r() * LASH_FAMILY_IDS.length)] as LashFamilyId) : null;
}

export function generateExtraEye(index: number, expression?: EyeInput['expression']): EyeInput {
  const rc = extraEyeRecipes()[index];
  if (!rc) throw new Error(`generateExtraEye: index ${index} hors 0..${EXTRA_EYE_COUNT - 1}`);
  let eye = buildExtraEye(rc, 0);
  for (let attempt = 1; attempt <= 6 && !verifyEye(eye as never).ok; attempt++) eye = buildExtraEye(rc, attempt);
  // Expression : appliquée APRÈS la validation neutre (comme `galleryEye` : l'identité reste celle de la recette, seule l'expression change).
  return expression ? ({ ...eye, expression } as EyeInput) : eye;
}

/** `override` (passe 9) : transforme l'œil AVANT la calibration du rayon d'iris (la seconde galerie y remplace l'iris par une famille « photo ») ; absent : comportement historique. */
export function buildExtraEye(rc: EyeRecipe, attempt: number, override?: (e: EyeInput) => EyeInput): EyeInput {
  const e = generateRandomEye(rc.seed, { id: `extra-${rc.index}`, expression: { kind: 'neutral', intensity: 1 } });
  const rnd = mulberry32(rc.seed ^ 0x5bd1e995);
  // Pupille : ronde le plus souvent (références), fente verticale / losange en accent ; taille mesurée (pupille / iris 0,13–0,28 -> 0,2–0,34).
  const pr = rnd();
  const pupilShape = pr < 0.78 ? 'round' : pr < 0.9 ? 'slit_vertical' : 'diamond';
  // ~60 % des yeux reçoivent une famille d'iris dérivée des références ; les autres gardent la palette naturelle tirée par la graine.
  const fam = rnd() < 0.6 ? irisFamily(IRIS_FAMILIES[Math.floor(rnd() * IRIS_FAMILIES.length)] as (typeof IRIS_FAMILIES)[number], rnd) : null;
  // Regard contenu : un iris grand (≈ hauteur d'ouverture, mesuré) ne supporte pas un fort déplacement sans sortir de l'ouverture.
  const cl = (v: number, m: number): number => Math.max(-m, Math.min(m, v));
  const calm = attempt === 0 ? 1 : 0;
  const gaze = { ...e.gaze, yawDeg: cl(e.gaze?.yawDeg ?? 0, 8) * calm, pitchDeg: cl(e.gaze?.pitchDeg ?? 0, 5) * calm };
  const simple = attempt >= 2;
  const base0 = {
    ...e,
    // 'alien' impose un rayon d'iris absolu (presets.ts) qui annulerait la calibration sur l'ouverture : écarté ici, les autres archétypes ne touchent pas au rayon.
    archetype: e.archetype === 'alien' ? null : e.archetype,
    gaze,
    shape: { width: WIDTH, height: WIDTH * rc.aspect, tiltDeg: rc.tiltDeg, upperFraction: rc.upperFraction, openness: rc.openness, outerSide: 'right', style: rc.style },
    canthi: { inner: { roundness: rc.innerRoundness, caruncle: rc.caruncle }, outer: { roundness: rc.outerRoundness } },
    epicanthicFold: { amount: rc.foldAmount, reach: e.epicanthicFold?.reach ?? 0.6 },
    iris: { ...e.iris, radius: 0.4, aspect: ['round', 'chibi', 'circle'].includes(rc.style) ? Math.max(ROUND_IRIS_ASPECT[0], Math.min(ROUND_IRIS_ASPECT[1], e.iris?.aspect ?? 1)) : e.iris?.aspect, limbalRing: 0.6 + rnd() * 0.3, ...(fam ? { layers: fam.layers, ...(fam.detail ? { detail: fam.detail } : {}) } : {}) },
    pupil: { ...e.pupil, shape: pupilShape, size: (PUPIL_OVER_IRIS[0] + rnd() * (PUPIL_OVER_IRIS[1] - PUPIL_OVER_IRIS[0])) },
    ...(fam ? { highlights: { list: simple ? fam.highlights.slice(0, 2) : fam.highlights } } : simple ? { highlights: { list: [{ kind: 'reflection', size: 0.22 }] } } : {}),
  } as EyeInput;
  // Look issu des références (naturel mesuré / encre / sprite) : tiré APRÈS tous les autres tirages pour ne pas les décaler.
  const base = override ? override(base0) : base0;
  const look = lookForRef(rc.ref, rnd);
  const looked = applyLook(base, look, rnd, rc.aspect, rc.ref);
  const lashFam = attempt >= 4 ? null : lashFamilyForRecipe(rc);   // dernier recours après 4 échecs de vérification : cils naturels du tirage (la famille déterministe de l'indice ne pouvait pas rentrer dans la zone de cette enveloppe)
  const out = lashFam ? applyLashFamily(looked, lashFam, { ink: look === 'ink' ? 'keep' : 'family' }) : looked;
  const inked = look === 'ink' ? inkLines(out, rc.ref) : out;
  // Rayon d'iris CALIBRÉ sur l'ouverture réelle : diamètre vertical = IRIS_OVER_HEIGHT × hauteur d'ouverture (références : 0,98–1,08), réduit à chaque nouvelle tentative.
  const spec = resolveEye(EyeSpec.parse(inked));
  const geo = openingGeometry(spec.shape, spec.canthi);
  const openH = openingProfile(geo).aspect * geo.w;
  const ry = irisRadii(spec).ry;
  const target = (look === 'sprite-tall' ? SPRITE_IRIS_OVER_HEIGHT : look === 'ink' ? INK_IRIS_OVER_HEIGHT : rc.style === 'compressed' ? 0.94 : IRIS_OVER_HEIGHT) * 0.92 ** attempt;
  return { ...inked, iris: { ...(inked.iris as object), radius: Math.max(0.15, Math.min(0.4 * ((openH / 2) * target) / ry, 0.55)) } } as EyeInput;
}

/** Distances minimales (voir en-tête) : aux 48 yeux existants, et entre les 100 nouveaux. */
export function distinctness(): { readonly minToExisting: number; readonly minAmongNew: number; readonly byStyle: Record<string, number> } {
  const ex = existingVectors();
  const rc = extraEyeRecipes();
  const vs = rc.map((r) => {
    const shape = Shape.parse({ width: WIDTH, height: WIDTH * r.aspect, tiltDeg: r.tiltDeg, upperFraction: r.upperFraction, openness: r.openness, style: r.style });
    return profileVector(shape, Canthi.parse({ inner: { roundness: r.innerRoundness, caruncle: r.caruncle }, outer: { roundness: r.outerRoundness } }));
  });
  let minToExisting = Infinity; let minAmongNew = Infinity;
  vs.forEach((v, i) => { for (const e of ex) minToExisting = Math.min(minToExisting, dist(v, e)); for (let j = i + 1; j < vs.length; j++) minAmongNew = Math.min(minAmongNew, dist(v, vs[j] as number[])); });
  const byStyle: Record<string, number> = {};
  for (const r of rc) byStyle[r.style] = (byStyle[r.style] ?? 0) + 1;
  return { minToExisting, minAmongNew, byStyle };
}
