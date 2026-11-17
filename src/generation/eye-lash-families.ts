import { mulberry32 } from '../core/prng';
import { EyeSpec } from '../schema';
import { eyeLashSet, openingGeometry } from '../geometry/eye';
import { lashZoneExcess, pointsZoneExcess } from '../geometry/eye/lash-zone';
import { linerGeometry } from '../geometry/eye/liner';

/**
 * FAMILLES DE CILS tirées des références 12, 13, 14, 15, 16 (traits noirs sur blanc ou sur sclère), échantillonnées par scripts/eye-refs/extract_lashes.py (v2 : regroupement autour de
 * chaque iris, orientation externe par appariement de miroir ou ancre visuelle, tracé ordonné de chaque cil) -> references/eyes/measures-lashes.json. Ce ne sont PAS de nouveaux moteurs :
 * chaque famille ne fait que régler les paramètres du moteur de cils existant (src/schema/eye-lashes.ts, src/geometry/eye/lashes.ts, lash-extras.ts, src/render/eye/lashes-render.ts),
 * dont deux paramètres ont été ajoutés pour ce que les références montrent et que le moteur ne savait pas faire : `bendDeg` (courbure en S) et `rootFuse` (racine fondue), et `span` (zone du bord).
 *
 * Provenance de chaque valeur : « M » mesurée sur les pixels (ordre de grandeur ; voir les bornes ci-dessous), « I » interprétée sur les planches, « C » conversion d'unité (mesures en fraction
 * de la LARGEUR de l'œil, moteur en fraction de sa HAUTEUR ; rapport largeur/hauteur ≈ 2 dans les références, donc longueur moteur ≈ 2 × longueur mesurée).
 * Bornes mesurées (references/eyes/measures-lashes.json, `summary`) : position médiane des pointes 0,65–0,83 (moitié externe) ; courbure médiane −3° à −32° (la pointe se redresse), P10 jusqu'à
 * −49° à −73° pour les ailes ; longueur médiane des traits latéraux 0,12–0,14 L, P90 0,19–0,6 L ; largeur à mi-longueur 0,37–0,74 de la base (effilement).
 */
export type LashFamilyId =
  | 'plume' | 'touffes' | 'frange-dense' | 'fin-feminin' | 'aile-liner' | 'rond-kawaii'
  | 'trio-externe' | 'touffes-bas' | 'ticks-reguliers' | 'trainants';

type Patch = Record<string, unknown>;
/**
 * Encre des cils : noir NEUTRE opaque, MESURÉ sur les pixels des références (references/eyes 12, 13, 15, 16 : luminance médiane de l'encre 0 à 2, BGR moyen du cœur 2–5, aucune dominante bleue ;
 * la réf. 14 (médiane 34, JPEG teinté) et la 17 (médiane 57, encre grise) sont d'autres styles et ne servent pas de référence d'encre). Auparavant `#120e18` (luminance ≈ 14, bleuté) : valeur
 * interprétée, plus claire que les aplats mesurés. Une seule encre pour le cil et le liner (racine, trait et cil forment une masse unie).
 */
export const LASH_INK_COLOR = '#040404';
const INK = { material: { base: { type: 'solid', color: LASH_INK_COLOR }, roughness: 0.6 }, opacity: 1, gloss: 0, colorVariation: 0 } as const;
export interface LashFamily {
  readonly id: LashFamilyId; readonly label: string; readonly sources: readonly string[]; readonly upper: Patch; readonly lower: Patch;
  /** Épaisseur du trait de paupière (`lids.thickness`, défaut du schéma 0,06) pour les styles tracés : les références montrent le cil enraciné dans un trait de paupière noir épais (valeur « I », interprétée sur les planches). N'abaisse jamais l'épaisseur déjà réglée. */
  readonly lidThickness?: number;
  /**
   * Trait de paupière ÉPAIS ET EFFILÉ (paramètre `lids.liner` du moteur, aucun code nouveau) : dans les références 12–16 le cil s'enracine dans une masse d'encre qui s'épaissit du canthus
   * interne (fin) vers le tiers externe puis s'effile en aile ; un trait d'épaisseur constante ne le rend pas (planche 06 d'avant). Épaisseur / début / sommet / aile : valeurs « I » (interprétées sur
   * les planches, l'épaisseur du trait n'est pas mesurée). Non appliqué si l'œil a déjà un liner.
   */
  readonly liner?: { thickness: number; start: number; peak: number; wing: { length: number; liftDeg: number; curve: number; sharpness: number; thickness: number } };
}
const W = (length: number, liftDeg: number, curve: number, sharpness = 0.92, thickness = 0.9) => ({ length, liftDeg, curve, sharpness, thickness });
/** Encre du liner : la même que celle des cils, pour que racine, trait et cil ne forment qu'une masse noire. */
const LINER_INK = LASH_INK_COLOR;

export const LASH_FAMILIES: Readonly<Record<LashFamilyId, LashFamily>> = {
  // Peu de cils longs, balayés vers l'extérieur, effilés en aiguille, aile finale recourbée. 13-03, 13-06, 13-07, 13-10 : 3 à 5 cils du haut (M), longueur max 0,5–0,7 L (M), pointe qui se redresse (M, bendDeg I).
  plume: {
    id: 'plume', label: 'Plumes / ailes balayées', sources: ['13-03', '13-06', '13-07', '13-10'],
    liner: { thickness: 1.7, start: 0.05, peak: 0.62, wing: W(0.22, 16, 0.35) },
    lidThickness: 0.095,
    upper: { count: 8, length: 0.3, thickness: 1.5, curl: 0.3, sweep: 40, tipSharpness: 0.9, bendDeg: 38, rootFuse: 1, span: { from: 0.35, to: 0.98 }, arch: { peak: 0.9, width: 0.3, strength: 0.8 }, outerLength: 1.0, outerLift: 0.3, lengthVariation: 0.3, orientationVariation: 4,
      flick: { count: 3, length: 0.7, reach: 0.2, liftDeg: 24, curl: 0.8 } },
    lower: { count: 3, length: 0.07, thickness: 0.3, tipSharpness: 0.8 },
  },
  // Cils courts réunis en touffes à pointes, larges à la base (13-00, 13-01, 13-11, 15 rangée 2) : 4 à 5 pointes (M), hauteur 0,07–0,12 L (M), effilement mi-longueur 0,56 (M).
  touffes: {
    id: 'touffes', label: 'Touffes à pointes', sources: ['13-00', '13-01', '13-11', '15-02', '15-03'],
    liner: { thickness: 1.6, start: 0.05, peak: 0.6, wing: W(0.16, 10, 0.3) },
    lidThickness: 0.09,
    upper: { count: 12, length: 0.26, thickness: 1.5, curl: 0.4, sweep: 26, tipSharpness: 0.8, bendDeg: 22, rootFuse: 1, clump: 0.7, clumpSize: 3, span: { from: 0.2, to: 0.97 }, arch: { peak: 0.78, width: 0.4, strength: 0.5 }, positionDispersion: 0.4, orientationVariation: 3, outerLength: 0.5 },
    lower: { count: 3, length: 0.07, thickness: 0.35 },
  },
  // Frange continue de nombreux cils fins, plus longs à l'extérieur : 13-05 (11 pointes, rapport externe/interne ~1,9 (M)) ; 16-24, 16-25 (frange haut et bas).
  'frange-dense': {
    id: 'frange-dense', label: 'Frange dense', sources: ['13-05', '16-24', '16-25'],
    liner: { thickness: 1.0, start: 0.08, peak: 0.7, wing: W(0.1, 8, 0.2) },
    upper: { count: 40, length: 0.2, thickness: 0.6, curl: 0.5, sweep: 30, tipSharpness: 0.9, bendDeg: 18, rootFuse: 0.6, span: { from: 0.08, to: 0.98 }, arch: { peak: 0.8, width: 0.5, strength: 0.55 }, lengthVariation: 0.35, orientationVariation: 9, positionDispersion: 0.5, outerLength: 0.9 },
    lower: { count: 16, length: 0.1, thickness: 0.3, tipSharpness: 0.88, orientationVariation: 8 },
  },
  // Style féminin fin : peu de traits très ouverts en éventail, aile courte au canthus externe. 12-04 à 12-09 : 2 à 5 traits par œil (M), 0,06–0,1 L (M), départ presque horizontal (78–86° de la normale, M).
  'fin-feminin': {
    id: 'fin-feminin', label: 'Fin, style féminin', sources: ['12-04', '12-05', '12-08', '12-09', '16-14', '16-15'],
    liner: { thickness: 1.25, start: 0.1, peak: 0.7, wing: W(0.2, 18, 0.4) },
    lidThickness: 0.085,
    upper: { count: 9, length: 0.26, thickness: 1.0, curl: 0.35, sweep: 46, tipSharpness: 0.95, bendDeg: 30, rootFuse: 0.8, span: { from: 0.4, to: 0.98 }, arch: { peak: 0.85, width: 0.35, strength: 0.6 }, outerLength: 0.7, outerLift: 0.2, orientationVariation: 4,
      flick: { count: 2, length: 0.55, reach: 0.14, liftDeg: 38, curl: 0.7 } },
    lower: { count: 2, length: 0.06, thickness: 0.3, tipSharpness: 0.9 },
  },
  // Quasi aucun cil visible, mais une aile épaisse de liner au canthus externe (réf. 15 rangée 3 ; 12-10) : 1 à 3 cils (M).
  'aile-liner': {
    id: 'aile-liner', label: 'Aile de liner', sources: ['12-10', '13-04', '15-04', '15-05'],
    liner: { thickness: 1.9, start: 0.08, peak: 0.75, wing: W(0.34, 22, 0.35, 0.95, 1.0) },
    lidThickness: 0.11,
    upper: { count: 4, length: 0.16, thickness: 1.5, curl: 0.2, sweep: 14, tipSharpness: 0.9, bendDeg: 30, rootFuse: 1, span: { from: 0.55, to: 0.99 }, arch: { peak: 0.9, width: 0.3, strength: 0.7 }, outerLength: 0.5,
      flick: { count: 2, length: 0.6, reach: 0.12, liftDeg: 24, curl: 0.25 } },
    lower: { count: 0 },
  },
  // Œil rond « kawaii » : une demi-douzaine de petits cils recourbés en éventail régulier autour du haut-externe du globe (16-12 … 16-19) : 2 à 6 cils du haut (M), 0,08–0,13 L (M).
  'rond-kawaii': {
    id: 'rond-kawaii', label: 'Rond kawaii', sources: ['16-16', '16-17', '16-20', '16-21'],
    liner: { thickness: 1.35, start: 0.05, peak: 0.55, wing: W(0.08, 6, 0.2, 0.8) },
    lidThickness: 0.08,
    upper: { count: 7, length: 0.2, thickness: 1.0, curl: 0.6, sweep: 56, tipSharpness: 0.8, bendDeg: 25, rootFuse: 0.8, span: { from: 0.4, to: 0.98 }, arch: { peak: 0.75, width: 0.5, strength: 0.3 }, outerLength: 0.2, orientationVariation: 2, lengthVariation: 0.1, positionDispersion: 0.1 },
    lower: { count: 3, length: 0.06, thickness: 0.4, tipSharpness: 0.85 },
  },
  // Éventail de 3 à 4 traits au seul canthus externe, presque horizontaux (12 rangées 1–2 : traits à 78–86° de la normale (M), 65 % de leurs racines au-delà de 0,6 de la paupière (M)).
  'trio-externe': {
    id: 'trio-externe', label: 'Éventail externe', sources: ['12-00', '12-01', '12-02', '12-03'],
    liner: { thickness: 1.4, start: 0.12, peak: 0.8, wing: W(0.2, 12, 0.3) },
    lidThickness: 0.09,
    upper: { count: 3, length: 0.3, thickness: 1.4, curl: 0.25, sweep: 60, tipSharpness: 0.95, bendDeg: 40, rootFuse: 1, span: { from: 0.72, to: 0.99 }, arch: { peak: 0.95, width: 0.3, strength: 0.4 }, lengthVariation: 0.2, orientationVariation: 5,
      flick: { count: 2, length: 0.5, reach: 0.1, liftDeg: 12, curl: 0.4 } },
    lower: { count: 1, length: 0.08, thickness: 0.4, tipSharpness: 0.9, span: { from: 0.8, to: 0.98 } },
  },
  // Cils du bas en petites touffes + cils du haut externes (15 rangée 4 ; 16 rangée 5 : frange basse) : 5 à 8 traits bas (M), longueur 0,08–0,2 L (M).
  'touffes-bas': {
    id: 'touffes-bas', label: 'Touffes hautes et basses', sources: ['15-06', '15-07', '16-24', '16-25'],
    liner: { thickness: 1.2, start: 0.08, peak: 0.7, wing: W(0.12, 8, 0.2) },
    lidThickness: 0.08,
    upper: { count: 8, length: 0.22, thickness: 1.3, curl: 0.35, sweep: 44, tipSharpness: 0.88, bendDeg: 25, rootFuse: 0.9, clump: 0.6, clumpSize: 2, span: { from: 0.45, to: 0.98 }, arch: { peak: 0.85, width: 0.4, strength: 0.6 }, outerLength: 0.6 },
    lower: { count: 6, length: 0.16, thickness: 1.0, curl: 0.3, sweep: 40, tipSharpness: 0.9, bendDeg: 20, rootFuse: 0.7, clump: 0.7, clumpSize: 2, span: { from: 0.1, to: 0.95 }, opacity: 1 },
  },
  // Petits traits réguliers tout autour du haut-externe et du bas (15 rangée 5 : œil rouge ; 16 rangée 4) : 8–14 traits courts (M), 0,05–0,1 L (M), dispersion faible.
  'ticks-reguliers': {
    id: 'ticks-reguliers', label: 'Traits réguliers', sources: ['15-08', '15-09', '16-18', '16-19'],
    liner: { thickness: 0.9, start: 0.1, peak: 0.7, wing: W(0.08, 6, 0.2) },
    upper: { count: 14, length: 0.14, thickness: 0.8, curl: 0.5, sweep: 60, tipSharpness: 0.85, bendDeg: 12, rootFuse: 0.5, span: { from: 0.25, to: 0.98 }, arch: { peak: 0.7, width: 0.6, strength: 0.25 }, orientationVariation: 2, positionDispersion: 0.05, lengthVariation: 0.1 },
    lower: { count: 8, length: 0.1, thickness: 0.6, sweep: 50, tipSharpness: 0.85, bendDeg: 10, positionDispersion: 0.1, opacity: 1 },
  },
  // Cils qui retombent vers l'extérieur, pointe couchée (réf. 14 : traits du canthus externe tracés vers le bas et vers l'extérieur, flèches rouges) : 6 à 13 traits (M), départ à ≈ 90° de la normale (M).
  trainants: {
    id: 'trainants', label: 'Cils traînants', sources: ['14-00', '14-02', '14-03', '14-05'],
    liner: { thickness: 1.3, start: 0.08, peak: 0.75, wing: W(0.24, 4, -0.5, 0.9) },
    lidThickness: 0.09,
    upper: { count: 6, length: 0.22, thickness: 1.2, curl: 0.4, sweep: 58, tipSharpness: 0.95, bendDeg: -22, rootFuse: 1, span: { from: 0.55, to: 0.99 }, arch: { peak: 0.95, width: 0.3, strength: 0.6 }, outerLength: 0.4,
      flick: { count: 3, length: 0.6, reach: 0.16, liftDeg: 8, curl: 0.1 } },
    lower: { count: 2, length: 0.09, thickness: 0.4, sweep: 45, tipSharpness: 0.9, span: { from: 0.6, to: 0.98 } },
  },
};

export const LASH_FAMILY_IDS = Object.keys(LASH_FAMILIES) as LashFamilyId[];

/**
 * Contrat d'APPARENCE d'une famille (audit §6.1 : l'ancienne fusion écrasait l'encre alors que le commentaire annonçait le contraire ; on sépare désormais structure et matière) :
 *  - `'family'` (défaut) : la famille impose son encre (noir mesuré des références : matériau, opacité 1, brillance 0, variation de teinte 0 ; cils du bas à 0,9 d'opacité) ;
 *  - `'keep'`   : la famille ne règle que la STRUCTURE (nombre, longueur, courbure, mèches…) ; matériau, opacité, brillance et variation de teinte déjà présents sur l'œil sont conservés,
 *                 sauf ce que la famille redéfinit elle-même (ex. `opacity` du bas d'une famille). Le trait de paupière (`lids.liner`) garde alors sa propre couleur (celle de l'œil, sinon l'encre).
 */
export type LashInkMode = 'family' | 'keep';
export interface ApplyLashFamilyOptions { readonly ink?: LashInkMode }

/** Applique une famille de cils à un œil (spec brute) : remplace les champs de STRUCTURE que la famille règle ; l'apparence suit `options.ink` (voir `LashInkMode`, défaut `'family'`). */
export function applyLashFamily<T extends Record<string, unknown>>(eye: T, id: LashFamilyId, options: ApplyLashFamilyOptions = {}): T {
  const fam = LASH_FAMILIES[id];
  const keep = options.ink === 'keep';
  const cur = ((eye as { lashes?: { upper?: Patch; lower?: Patch } }).lashes ?? {}) as { upper?: Patch; lower?: Patch };
  const lids = { ...(((eye as { lids?: Patch }).lids ?? {}) as Patch) };
  if (fam.lidThickness !== undefined) lids.thickness = Math.max(fam.lidThickness, (lids.thickness as number | undefined) ?? 0);
  if (fam.liner && !lids.liner) lids.liner = { color: LINER_INK, tipColor: null, gloss: 0, ...fam.liner };
  const upperInk: Patch = keep ? {} : INK;
  const lowerInk: Patch = keep ? {} : { ...INK, opacity: 0.9 };
  const out = { ...eye, ...(fam.lidThickness !== undefined || fam.liner ? { lids } : {}), lashes: { upper: { ...(cur.upper ?? {}), ...upperInk, ...fam.upper }, lower: { ...(cur.lower ?? {}), ...lowerInk, ...fam.lower } } } as T;
  return fitLashesToZone(out);
}

/** Marge sous la limite du contrôle `lashes-in-zone` (0,55) : les racines remontées par le liner allongent la portée des cils ; on raccourcit (longueur et mèches de coin) jusqu'à rentrer dans la zone. */
export const ZONE_TARGET = 0.5;
function fitLashesToZone<T extends Record<string, unknown>>(eye: T): T {
  let cur = eye;
  for (let k = 0; k < 10; k++) {
    const spec = EyeSpec.parse(cur);   // échoue tout de suite si une famille sort du schéma
    const g = openingGeometry(spec.shape, spec.canthi); const th = spec.lids.thickness * spec.shape.height;
    const set = eyeLashSet(spec, g, th);
    // l'aile du liner (sa pointe et son bord haut) compte aussi dans la zone du dessin : l'œil 13 de la galerie (réf. 15-B, sprite haut) la dépassait de quelques pixels
    const liner = spec.lids.liner; const linerOut = liner ? pointsZoneExcess(g, (() => { const lg = linerGeometry(g, liner, th); return [lg.tip, ...lg.top]; })()) : 0;
    if (lashZoneExcess(g, [...set.upper, ...set.lower]) <= ZONE_TARGET && linerOut <= ZONE_TARGET) return cur;
    if (linerOut > ZONE_TARGET) { const L = (cur as unknown as { lids: { liner: { wing: { length: number } } } }).lids; cur = { ...cur, lids: { ...L, liner: { ...L.liner, wing: { ...L.liner.wing, length: L.liner.wing.length * 0.88 } } } }; continue; }
    const lz = (cur as unknown as { lashes: { upper: { length?: number; flick?: { length?: number; count?: number } }; lower: { length?: number } } }).lashes;
    // bornes du schéma (cils ≥ 0,02 ; mèche de coin ≥ 0,15) : sans elles, une enveloppe très ronde faisait lever une ZodError
    const f = 0.93;
    cur = { ...cur, lashes: { ...lz, upper: { ...lz.upper, length: Math.max(0.02, (lz.upper.length ?? spec.lashes.upper.length) * f), ...(lz.upper.flick?.count ? { flick: { ...lz.upper.flick, length: Math.max(0.15, (lz.upper.flick.length ?? spec.lashes.upper.flick.length) * f) } } : {}) }, lower: { ...lz.lower, length: Math.max(0.02, (lz.lower.length ?? spec.lashes.lower.length) * f) } } };
  }
  return cur;
}

/** Famille de cils tirée d'une graine de visage : flux dérivé DÉDIÉ (`seed ^ 0x7c15a3e1`), donc aucun autre tirage du visage ne bouge ; uniforme sur les 10 familles. */
export function lashFamilyForSeed(seed: number): LashFamilyId {
  return LASH_FAMILY_IDS[Math.floor(mulberry32((seed ^ 0x7c15a3e1) >>> 0)() * LASH_FAMILY_IDS.length)] as LashFamilyId;
}
