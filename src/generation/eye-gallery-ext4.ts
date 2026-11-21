import { mulberry32 } from '../core/prng';
import { openingGeometry } from '../geometry/eye';
import { Canthi } from '../schema/eye-canthi-fold';
import { Shape } from '../schema/eye-shape';
import { checkEyeEnvelope } from '../verify/eye-envelope';
import { verifyEye } from '../verify/eye';
import { WIDTH, buildExtraEye, dist, existingVectorsTrue, extraEyeRecipes, profileVector, type Cand, type EyeRecipe, STYLES } from './eye-gallery-ext';
import { applyIrisPreset, extra2Recipes, selectRecipes, vectorOf } from './eye-gallery-ext2';
import { extra3Recipes } from './eye-gallery-ext3';
import { PHOTO2_IRIS_FAMILIES, photoIrisFamily2, type Photo2IrisFamily } from './eye-iris-families-photo2';
import { REF_FITS } from './eye-ref-fits';
import type { EyeInput } from './random-eye-helpers';

/**
 * QUATRIÈME GALERIE (passe 11) : 100 yeux de plus, AVEC de NOUVELLES ENVELOPPES. Les galeries 1 à 3 tirent leurs formes dans le domaine historique de `candidates`
 * (aspect 0,44–0,70, inclinaison −5° à 14°, ouverture 0,82–1,10) : il est saturé (`diamond` n'a que 2 yeux en galerie 3). Les silhouettes TRACÉES sur les réfs 13 et 17
 * (`eye-ref-fits.ts`, 27 recettes ajustées) couvrent un domaine bien plus large (aspect 0,34–1,17, inclinaison −14° à +16°, fraction haute 0,40–0,75, ouverture 0,52–1,16) :
 * la galerie 4 échantillonne CE domaine — par interpolation (et légère extrapolation) entre deux silhouettes mesurées du MÊME style, plus un bruit borné — et choisit les formes les plus
 * éloignées des 348 profils existants. Pas de nouveau moteur ni de nouveau style : les mêmes 12 enveloppes, d'autres régions de leur espace de paramètres.
 * Chaque œil reçoit aussi `shape.lowerPeak` (creux de la paupière basse) tiré dans la plage MESURÉE 0,40–0,65 (passe 10, § 6) : le paramètre est consommé (il entre dans le profil
 * qui sert à prouver la distinction) et n'existait dans aucune galerie.
 */
export const EXTRA4_COUNT = 100;
/** Distance minimale (profils, largeur = 1) aux 348 formes existantes. */
export const NEW4_MIN_DIST = 0.009;
/** Plage mesurée du creux de la paupière basse (réfs 04, 07, 11 : 0,40–0,65). */
export const LOWER_PEAK_RANGE = [0.4, 0.65] as const;
const PHOTO2_SHARE = 0.8;
/** Domaine mesuré (réfs 13/15/17) élargi de 4 % de chaque côté, borné par le schéma ; l'aspect est borné à 0,8 (au-delà, aucune famille de cils ne tient dans la zone). */
const SCHEMA = { aspect: [0.1, 0.8], tiltDeg: [-30, 30], upperFraction: [0.4, 0.8], openness: [0.05, 1.2] } as const;
const span = (k: 'aspect' | 'tiltDeg' | 'upperFraction' | 'openness'): [number, number] => { const v = REF_FITS.map((f) => f[k]); const lo = Math.min(...v), hi = Math.max(...v); const m = (hi - lo) * 0.04; return [Math.max(SCHEMA[k][0], lo - m), Math.min(SCHEMA[k][1], hi + m)]; };
const DOMAIN = { aspect: span('aspect'), tiltDeg: span('tiltDeg'), upperFraction: span('upperFraction'), openness: span('openness') };
const clamp = (v: number, [a, b]: readonly [number, number]): number => Math.max(a, Math.min(b, v));

/**
 * Silhouettes `almond` MESURÉES (references/eyes/measures.json, photos 03 04 05 07 10a 10b 11 : aspect, fraction haute, inclinaison ; comparées au JSON par tests/eye-gallery-ext4.test.ts).
 * Aucune silhouette 13/17 n'est `almond` : sans ces ancres la galerie 4 n'aurait aucun almond, alors que c'est l'enveloppe que `lowerPeak` sert (refs 04, 07, 11).
 */
export const ALMOND_ANCHORS = [
  { id: '04', aspect: 0.547, upperFraction: 0.772, tiltDeg: 0.52 }, { id: '10a', aspect: 0.58, upperFraction: 0.616, tiltDeg: 22.11 }, { id: '10b', aspect: 0.475, upperFraction: 0.55, tiltDeg: 18.89 },
  { id: '07', aspect: 0.545, upperFraction: 0.574, tiltDeg: 5.71 }, { id: '11', aspect: 0.473, upperFraction: 0.61, tiltDeg: 0.98 }, { id: '03', aspect: 0.679, upperFraction: 0.472, tiltDeg: 7.7 }, { id: '05', aspect: 0.491, upperFraction: 0.55, tiltDeg: -3.81 },
] as const;
const ALMOND_AS_FITS = ALMOND_ANCHORS.map((a) => ({ id: a.id, style: 'almond', aspect: a.aspect, tiltDeg: a.tiltDeg, upperFraction: a.upperFraction, openness: 1, innerRoundness: 0.5, outerRoundness: 0.5 }));

/** Candidats d'un style : interpolation entre deux silhouettes mesurées du même style (t ∈ [−0,2 ; 1,2]) + bruit de 6 % de la plage du domaine ; aucun candidat hors domaine mesuré. */
export function refCandidates(style: (typeof STYLES)[number], rnd: () => number): Cand[] {
  const fits = style === 'almond' ? ALMOND_AS_FITS : REF_FITS.filter((f) => f.style === style); const out: Cand[] = [];
  const wide = style === 'almond' ? 0.8 : 0.3;   // les ancres almond n'ont pas de rondeur de canthus mesurée : tirage large ; silhouettes ajustées : bruit de 0,3
  if (fits.length === 0) return out;
  const r = (a: number, b: number): number => a + rnd() * (b - a);
  for (let n = 0; n < 900 && out.length < 320; n++) {
    const a = fits[Math.floor(rnd() * fits.length)]!, b = fits[Math.floor(rnd() * fits.length)]!; const t = r(-0.2, 1.2);
    const lerp = (x: number, y: number): number => x + (y - x) * t;
    const noise = (d: readonly [number, number]): number => (rnd() - 0.5) * 2 * (d[1] - d[0]) * 0.06;
    const c = {
      style, aspect: clamp(lerp(a.aspect, b.aspect) + noise(DOMAIN.aspect), DOMAIN.aspect), tiltDeg: clamp(lerp(a.tiltDeg, b.tiltDeg) + noise(DOMAIN.tiltDeg), DOMAIN.tiltDeg),
      upperFraction: clamp(lerp(a.upperFraction, b.upperFraction) + noise(DOMAIN.upperFraction), DOMAIN.upperFraction), openness: clamp(lerp(a.openness, b.openness) + noise(DOMAIN.openness), DOMAIN.openness),
      innerRoundness: clamp(lerp(a.innerRoundness, b.innerRoundness) + (rnd() - 0.5) * wide, [0.05, 0.95]), outerRoundness: clamp(lerp(a.outerRoundness, b.outerRoundness) + (rnd() - 0.5) * wide, [0.05, 0.95]),
      caruncle: r(0.2, 0.8), foldAmount: rnd() < 0.35 ? r(0.3, 1) : 0, lowerPeak: r(LOWER_PEAK_RANGE[0], LOWER_PEAK_RANGE[1]),
    };
    const shape = Shape.parse({ width: WIDTH, height: WIDTH * c.aspect, tiltDeg: c.tiltDeg, upperFraction: c.upperFraction, openness: c.openness, style, lowerPeak: c.lowerPeak });
    const canthi = Canthi.parse({ inner: { roundness: c.innerRoundness, caruncle: c.caruncle }, outer: { roundness: c.outerRoundness } });
    if (checkEyeEnvelope(openingGeometry(shape, canthi), style, 0).some((k) => !k.ok && k.severity === 'error')) continue;
    out.push({ ...c, d: profileVector(shape, canthi) });
  }
  return out;
}

export interface Eye4Recipe extends EyeRecipe { readonly irisFamily: Photo2IrisFamily | null; }

const takenProfiles = (): number[][] => [...existingVectorsTrue(), ...extraEyeRecipes().map(vectorOf), ...extra2Recipes().map(vectorOf), ...extra3Recipes().map(vectorOf)];

let memo: Eye4Recipe[] | null = null;
export function extra4Recipes(): readonly Eye4Recipe[] {
  if (memo) return memo;
  const order = selectRecipes(takenProfiles(), 0x2d9c6b17, EXTRA4_COUNT, NEW4_MIN_DIST, refCandidates);
  memo = order.map((r, i) => {
    const seed = 30000 + i * 157; const rnd = mulberry32(seed ^ 0x3c6ef372);   // flux À PART : la famille d'iris ne décale aucun autre tirage
    const irisFamily = rnd() < PHOTO2_SHARE ? (PHOTO2_IRIS_FAMILIES[Math.floor(rnd() * PHOTO2_IRIS_FAMILIES.length)] as Photo2IrisFamily) : null;
    return { ...r, index: i, seed, irisFamily };
  });
  return memo;
}

export function generateExtra4Eye(index: number, expression?: EyeInput['expression']): EyeInput {
  const rc = extra4Recipes()[index];
  if (!rc) throw new Error(`generateExtra4Eye: index ${index} hors 0..${extra4Recipes().length - 1}`);
  const build = (attempt: number): EyeInput => {
    const eye = buildExtraEye(rc, attempt, rc.irisFamily ? (e) => applyIrisPreset(e, photoIrisFamily2(rc.irisFamily as Photo2IrisFamily, mulberry32(rc.seed ^ 0x2545f491)), rc.style, attempt >= 2) : undefined);
    return { ...eye, id: `extra4-${rc.index}` } as EyeInput;
  };
  let eye = build(0);
  for (let attempt = 1; attempt <= 6 && !verifyEye(eye as never).ok; attempt++) eye = build(attempt);
  return expression ? ({ ...eye, expression } as EyeInput) : eye;
}

/** Distances minimales (largeur = 1) aux 348 yeux existants et entre les nouveaux ; effectif par style ; plage de `lowerPeak` effectivement tirée ; domaine d'aspect / inclinaison couvert. */
export function distinctness4(): { readonly count: number; readonly minToExisting: number; readonly minAmongNew: number; readonly byStyle: Record<string, number>; readonly lowerPeak: readonly [number, number]; readonly aspect: readonly [number, number]; readonly tiltDeg: readonly [number, number] } {
  const ex = takenProfiles(); const rc = extra4Recipes(); const vs = rc.map(vectorOf);
  let minToExisting = Infinity, minAmongNew = Infinity;
  vs.forEach((v, i) => { for (const e of ex) minToExisting = Math.min(minToExisting, dist(v, e)); for (let j = i + 1; j < vs.length; j++) minAmongNew = Math.min(minAmongNew, dist(v, vs[j] as number[])); });
  const byStyle: Record<string, number> = {}; for (const r of rc) byStyle[r.style] = (byStyle[r.style] ?? 0) + 1;
  const mm = (f: (r: Eye4Recipe) => number): [number, number] => { const v = rc.map(f); return [Math.min(...v), Math.max(...v)]; };
  return { count: rc.length, minToExisting, minAmongNew, byStyle, lowerPeak: mm((r) => r.lowerPeak ?? NaN), aspect: mm((r) => r.aspect), tiltDeg: mm((r) => r.tiltDeg) };
}
