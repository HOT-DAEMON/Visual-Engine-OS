import { microLod, type Lod } from './micro-detail';
import type { Lash } from './lashes';
import type { OpeningGeometry } from './opening';

/**
 * EYE-07 — NIVEAU DE DÉTAIL AUTOMATIQUE (source unique). `lod.eyePixels` n'est plus renseigné à la main : il est DÉRIVÉ de ce que la scène sait déjà —
 * largeur d'enveloppe de l'œil (`shape.width`) × échelle MONDE de l'œil posé (`transform.scale`, hôte ∘ ancre ∘ objet, déjà composée par `expandPlacements`)
 * × `pixelRatio` du rendu (1 unité de scène = 1 px ; un rastériseur qui zoome le passe à `renderScene`). Un nombre explicite dans `lod.eyePixels` reste prioritaire.
 * Un seul calcul alimente les DEUX consommateurs : les microdétails de la sclère (`microLod`) et le détail atomique de l'iris (`irisLod`), plus `verifyEye`.
 */
export const LOD_PIXELS_MIN = 8;
export const LOD_PIXELS_MAX = 8000;

/** Largeur approximative de l'œil dans l'image finale, en pixels. */
export const eyePixelWidth = (shapeWidth: number, worldScale: number, pixelRatio = 1): number => shapeWidth * Math.abs(worldScale) * pixelRatio;

/**
 * `explicit` (nombre) l'emporte ; `null` = automatique, borné aux limites du schéma. `widthRatio` (0..1, défaut 1) : raccourcissement apparent de la largeur de l'œil par la rotation de tête
 * (voir `apparentWidthRatio`) — un œil vu à 70° n'a que ~1/3 de sa largeur de face en pixels et n'a pas besoin du même détail ; 1 = de face, résultat identique à l'ancien.
 */
export function resolveEyePixels(explicit: number | null, shapeWidth: number, worldScale: number, pixelRatio = 1, widthRatio = 1): number {
  if (explicit !== null) return explicit;
  return Math.min(LOD_PIXELS_MAX, Math.max(LOD_PIXELS_MIN, eyePixelWidth(shapeWidth, worldScale, pixelRatio) * widthRatio));
}

/** Rapport largeur apparente / largeur de face de l'ouverture tournée (`turnOpening`) ; 1 sans rotation sphérique. Borné à [0,15 ; 1] (un œil de profil garde un peu de détail). */
export function apparentWidthRatio(g0: OpeningGeometry, turned: { readonly g: OpeningGeometry } | null): number {
  return turned ? Math.min(1, Math.max(0.15, turned.g.bbox.w / (g0.bbox.w || 1))) : 1;
}

/**
 * LOD DES CILS (EYE-07). Un cil plus fin qu'~0,6 px n'est qu'un voile de gris : tracé un par un il coûte un nœud SVG chacun pour un résultat que la rastérisation moyenne de toute façon.
 * Quand la largeur de base MÉDIANE (px) passe sous `LASH_MIN_PX`, on ne garde qu'une part k = médiane / seuil (≥ `LASH_KEEP_MIN`) des cils, répartie régulièrement (Bresenham : ordre et positions
 * conservés, aucun tirage), et chaque cil gardé est épaissi de 1/k : n × largeur (la COUVERTURE d'encre) reste constante. `pxPerUnit = null` ou cils assez épais : liste rendue telle quelle (mêmes objets).
 */
export const LASH_MIN_PX = 0.6;
export const LASH_KEEP_MIN = 0.4;
export function lashKeepShare(lashes: readonly Lash[], pxPerUnit: number | null): number {
  if (pxPerUnit === null || lashes.length < 4) return 1;
  const w = lashes.map((l) => l.baseWidth * pxPerUnit).sort((a, b) => a - b); const med = w[Math.floor(w.length / 2)] as number;
  return med >= LASH_MIN_PX ? 1 : Math.min(1, Math.max(LASH_KEEP_MIN, med / LASH_MIN_PX));
}
export function thinLashes(lashes: readonly Lash[], pxPerUnit: number | null): Lash[] {
  const k = lashKeepShare(lashes, pxPerUnit);
  if (k >= 1) return [...lashes];
  return lashes.flatMap((l, i): Lash[] => (Math.floor((i + 1) * k) > Math.floor(i * k) ? [{ ...l, baseWidth: l.baseWidth / k }] : []));
}

/** Niveau de détail de l'IRIS selon son diamètre en pixels. `null` (iris isolé, hors rendu d'œil) = pleine précision. */
export interface IrisLod {
  /** Part (0–1) des fibres fines du stroma réellement tracées : les tirages sont TOUS faits, seul le tracé est réduit (identité stable). */
  readonly fibers: number;
  /** Taille minimale (px) en dessous de laquelle un atome (braise, biseau, fente, détail de bulle) n'est plus tracé : il ne ferait qu'un bruit sub-pixel. */
  readonly minAtomPx: number;
}
const ramp = (v: number, a: number, b: number): number => Math.min(1, Math.max(0, (v - a) / (b - a)));
export function irisLod(irisDiameterPx: number | null): IrisLod {
  if (irisDiameterPx === null) return { fibers: 1, minAtomPx: 0 };
  return { fibers: 0.25 + 0.75 * ramp(irisDiameterPx, 24, 120), minAtomPx: 0.45 };
}

/** Tout le LOD d'un œil en un appel (pour les tests et `verifyEye`). */
export function eyeLod(eyePixels: number, irisRadiusOverWidth: number): { readonly micro: Lod; readonly iris: IrisLod } {
  return { micro: microLod(eyePixels), iris: irisLod(2 * irisRadiusOverWidth * eyePixels) };
}
