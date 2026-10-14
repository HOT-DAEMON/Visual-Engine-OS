/**
 * Constantes réglables du système de matériaux partagé (voir compile-surface.ts). Regroupées ici
 * pour que l'accord esthétique global (contraste du métal, taille des reflets, etc.) se règle en un
 * seul endroit, sans avoir à modifier la logique de rendu.
 *
 * Statut des formules qui les consomment :
 *  - PHYSIQUE : position du reflet spéculaire sur une sphère (vecteur médian exact) ; orientation de
 *    la rampe d'environnement (le ciel reste en haut DU MONDE, même si l'objet est pivoté).
 *  - STYLISÉ : contenu de la rampe d'environnement du métal, bande de reflet sur surface plane,
 *    dosage de l'ombrage. Ce sont des approximations SVG, pas du PBR.
 */
export const SHADING = {
  diffuseMax: 0.55,
  focalShift: 0.28,
  metalDiffuseLoss: 0.6,
  metalContrastLoss: 0.6,
  metalSky: 0.55,
  metalAboveHorizon: 0.3,
  metalBelowHorizon: 0.6,
  metalGround: 0.1,
  metalTint: 0.6,
  specSizeMin: 0.08,
  specSizeRough: 0.3,
  specAlphaMax: 0.95,
  specAlphaRough: 0.75,
  specSoftMin: 0.25,
  specSoftRough: 0.7,
  coatSize: 0.07,
  coatSoft: 0.2,
  coatAlpha: 0.95,
  flatBandCenter: 0.28,
  emissionOverlay: 0.45,
  emissionHalo: 0.6,
} as const;
