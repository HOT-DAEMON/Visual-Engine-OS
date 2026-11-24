import { microLod, type Lod } from './micro-detail';

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

/** `explicit` (nombre) l'emporte ; `null` = automatique, borné aux limites du schéma. */
export function resolveEyePixels(explicit: number | null, shapeWidth: number, worldScale: number, pixelRatio = 1): number {
  if (explicit !== null) return explicit;
  return Math.min(LOD_PIXELS_MAX, Math.max(LOD_PIXELS_MIN, eyePixelWidth(shapeWidth, worldScale, pixelRatio)));
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
