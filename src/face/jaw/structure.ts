import { clamp } from '../../core/math';
import type { FaceParams } from '../../schema';

/**
 * Structure profonde de la mâchoire : tout ce que le contour (`contour.ts`) et les repères lisent pour savoir COMMENT la silhouette extérieure
 * est composée (T3, T4, T5, T6 de `docs/TODO-FACE-SPEC.md`). Fonctions PURES, une seule source de vérité : aucun autre fichier ne recalcule ces grandeurs.
 */

/** Décomposition de la largeur de mâchoire (demi-largeurs, px) : os, muscle, graisse, et silhouette extérieure qui en résulte. */
export interface JawSilhouette {
  /** Demi-largeur OSSEUSE (bigoniaque) : `jawWidth × W / 2`. */
  readonly boneHalf: number;
  /** Ajout dû au muscle masséter (volume de repos + serrage `deform.articulation.clench`). */
  readonly muscleHalf: number;
  /** Ajout dû au tissu adipeux. */
  readonly fatHalf: number;
  /** Demi-largeur EXTÉRIEURE visible à l'angle de la mâchoire = os + muscle + graisse (bornée à 49,5 % de W : la mâchoire ne dépasse jamais le crâne). */
  readonly outerHalf: number;
}

/** Plafond de l'ajout muscle / graisse (fractions de W, pour une demi-largeur) : un masséter de culturiste ajoute au plus 4 % de W de chaque côté, la graisse 3 %. */
const MUSCLE_MAX = 0.04;
const FAT_MAX = 0.03;

export function jawSilhouette(p: FaceParams, W: number): JawSilhouette {
  // Os : le paramètre historique `jawWidth` est désormais LA largeur osseuse.
  const boneHalf = (p.jawWidth * W) / 2;
  // Muscle : volume de repos + serrage des mâchoires (le serrage gonfle le masséter jusqu'à 60 % du volume maximal).
  const muscle = clamp(p.softTissue.masseter.volume + 0.6 * p.deform.articulation.clench, 0, 1);
  const muscleHalf = muscle * MUSCLE_MAX * W;
  // Graisse : ajout direct.
  const fatHalf = p.softTissue.fat * FAT_MAX * W;
  // Silhouette : somme, puis plafond (le crâne a une demi-largeur W/2 à la tempe).
  const outerHalf = Math.min(0.495 * W, boneHalf + muscleHalf + fatHalf);
  return { boneHalf, muscleHalf, fatHalf, outerHalf };
}

/** Angle mandibulaire EFFECTIF (0 = anguleux, 1 = obtus) : la graisse et le masséter arrondissent l'angle apparent (le muscle recouvre l'os). */
export function effectiveAngle(p: FaceParams): number {
  // La graisse arrondit de 0,2 au plus ; le serrage des mâchoires accentue légèrement l'angle (−0,1 au plus) car le muscle se contracte et se durcit.
  return clamp(p.jaw.angle + 0.2 * p.softTissue.fat - 0.1 * p.deform.articulation.clench, 0, 1);
}

/** Forme du bas du menton : trois grandeurs géométriques (part de la hauteur sous le coin, tangente d'arrivée, longueur de poignée du méplat). */
export interface ChinShape {
  /** Part de la hauteur du menton comprise entre le coin du menton et le bas (profondeur de la symphyse). */
  readonly rise: number;
  /** Tangente du menton au coin (vers le bas, légèrement vers l'intérieur). */
  readonly tangent: { readonly x: number; readonly y: number };
  /** Longueur de la poignée horizontale du bas (0 = arrondi serré ou pointe, ~1 = méplat). */
  readonly flat: number;
  /** `true` pour un menton pointu (arrivée oblique, apex en V voulu). */
  readonly pointed: boolean;
}

/** Les quatre symphyses historiques, exprimées comme points d'une forme continue (valeurs identiques à celles de `contour.ts` d'avant). */
const ROUND: ChinShape = { rise: 0.5, tangent: { x: -0.3, y: 1 }, flat: 0.55, pointed: false };
const SQUARE: ChinShape = { rise: 0.3, tangent: { x: -0.05, y: 1 }, flat: 0.9, pointed: false };
const POINTED: ChinShape = { rise: 0.75, tangent: { x: -0.55, y: 1 }, flat: 0, pointed: true };
const CLEFT: ChinShape = { rise: 0.45, tangent: { x: -0.2, y: 1 }, flat: 0.7, pointed: false };
const mixShape = (a: ChinShape, b: ChinShape, t: number): ChinShape => ({
  rise: a.rise + (b.rise - a.rise) * t,
  tangent: { x: a.tangent.x + (b.tangent.x - a.tangent.x) * t, y: 1 },
  flat: a.flat + (b.flat - a.flat) * t,
  // L'apex en V n'existe qu'au-delà de 85 % du chemin vers le pointu : en deçà, la symphyse reste arrondie (continuité C1).
  pointed: b.pointed ? t >= 0.85 : a.pointed && t < 0.15,
});

export function chinShape(p: FaceParams): ChinShape {
  const c = p.chin;
  // Forme de base : continue si `form` est donné (−1 pointu … 0 rond … +1 carré), sinon l'une des quatre symphyses historiques.
  let s: ChinShape;
  if (c.form === null) s = { round: ROUND, square: SQUARE, pointed: POINTED, cleft: CLEFT }[c.symphysis];
  else s = c.form >= 0 ? mixShape(ROUND, SQUARE, c.form) : mixShape(ROUND, POINTED, -c.form);
  // Largeur de la symphyse : méplat de 0 (arrondi serré) à 0,95 ; ignorée pour un menton pointu (la pointe n'a pas de méplat).
  const flat = c.symphysisWidth === null || s.pointed ? s.flat : 0.95 * c.symphysisWidth;
  // Profondeur de la symphyse : 0,2 (menton qui se termine vite) à 0,8 (symphyse haute).
  const rise = c.symphysisDepth === null ? s.rise : 0.2 + 0.6 * c.symphysisDepth;
  return { ...s, flat, rise };
}

/** Longueur des poignées du corps de la mandibule (part de la distance coin → menton) : convergence (`taper`) et courbure (`mandible.bodyCurve`, ±0,2 aux extrêmes). */
export function bodyHandle(p: FaceParams): number {
  // Formule d'avant (0,3 → 0,55 selon `taper`) + 0,4 × (courbure − 0,5) ; bornée à 0,58 : au-delà le contour cesse d'être monotone en y (mesuré : boucles à 0,68 sur 9 visages sur 40).
  return clamp(0.3 + 0.25 * (1 - p.jaw.taper) + 0.4 * (p.mandible.bodyCurve - 0.5), 0.12, 0.58);
}

/**
 * Longueur de la poignée du ramus (part de la distance temple → gonion) : 0,35 = neutre (valeur historique). Des joues pleines la rallongent (la branche gonfle),
 * des joues creuses la raccourcissent. On agit sur la LONGUEUR de la poignée le long de la tangente d'arrivée, jamais sur sa position latérale : la continuité
 * de tangente (C1) avec l'arc du gonion est ainsi conservée par construction.
 */
export function ramusHandle(p: FaceParams): number {
  return clamp(0.35 + 0.3 * (p.cheek.volume - 0.5), 0.2, 0.5);
}
