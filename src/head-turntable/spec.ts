import { REF_FIT, REF_ROWS } from './ref-fit';
import type { HeadTurnSpec } from './types';

/**
 * TÊTE DE RÉFÉRENCE « planche de rotation » : sections du crâne et repères AJUSTÉS (ref-fit.ts, généré depuis les mesures de
 * `references/face/rotation_head.jpg`) + tailles et formes ANNOTÉES (relevées sur les mêmes images à la grille, ±0,01 U). Chaque
 * constante dit d'où elle vient : [ajusté] = moindres carrés sur les 9 vues ; [mesuré] = lu sur un masque ; [annoté] = relevé à la main.
 */
export const REF_SPEC: HeadTurnSpec = {
  rows: REF_ROWS,
  // Œil : position [ajusté] ; largeur 0,17 et hauteur totale 0,15 U [mesuré : 25 × 24 px à 0°] ; iris Ø 0,125 U [mesuré : 19 px].
  eye: { x: REF_FIT.eye.x, y: REF_FIT.eye.y, z: REF_FIT.eye.z, w: 0.17, hUp: 0.085, hLo: 0.065, irisR: 0.0625 },
  // Sourcil : arc de 0,07 à 0,26 U de l'axe, point haut vers 0,45 U [annoté, vue 0°].
  brow: { xIn: 0.07, xOut: 0.26, yIn: 0.5, yMid: 0.455, yOut: 0.49, thick: 0.009 },
  // Nez : bout [ajusté sur le profil], racine et base [annotés]. Largeur des ailes ±0,05 U [mesuré : 13 px entre narines à 0°].
  nose: { rootY: 0.64, rootZ: 0.46, tipY: REF_FIT.noseTip.y, tipZ: REF_FIT.noseTip.z, baseY: 0.8, alaX: 0.05, rBridge: 0.03, rTip: 0.04,
    // Profil du nez [mesuré sur le profil de 90°, retiré de la table de sections] : (y, z avant, demi-largeur [annotée]).
    knots: [[0.64, 0.46, 0.028], [0.66, 0.463, 0.03], [0.682, 0.48, 0.032], [0.708, 0.5, 0.035], [0.735, 0.527, 0.04], [0.76, 0.52, 0.046], [0.787, 0.513, 0.05], [0.8, 0.505, 0.046], [0.815, 0.499, 0.03]] },
  // Bouche : centre [ajusté] ; demi-largeur 0,10 U [mesuré : 30 px à 0°] ; ouverture 0,6 (sourire ouvert de la planche).
  mouth: { y: REF_FIT.mouth.y, z: REF_FIT.mouth.z, halfW: 0.1, open: 0.6, lipR: 0.02,
    // Profil des lèvres [mesuré sur le profil de 90°] : (y, z avant, demi-largeur = demi-largeur de bouche).
    knots: [[0.815, 0.497, 0.03], [0.84, 0.493, 0.1], [0.865, 0.475, 0.1], [0.885, 0.455, 0.07], [0.9, 0.447, 0.0]] },
  // Oreille : de y = 0,53 à 0,79 U [annoté 0° : 171 → 208 px, puis ÷ cos b], profondeur 0,14 U [annoté 90° : 21 px], ouverture 50° [annoté : largeur visible à 0° ≈ 0,115 U].
  ear: { x: 0.33, y0: 0.55, y1: 0.78, z: 0.0, depth: 0.15, thick: 0.03, openDeg: 50, tiltDeg: 8 },
  // Cou : demi-largeur 0,143 U [mesuré 0° et 180°] ; dos du cou à z = -0,11 U [mesuré sur le profil 90°], demi-profondeur 0,15 U [annoté].
  neck: { a: 0.143, b: 0.15, zc: 0.04, y0: 0.74, y1: 1.2 },
  // Lisière des cheveux [ajustée] par recouvrement (IoU) avec les masques de cheveux de la planche (scripts/head-turntable/fit-hairline.ts) :
  // calage sur 0°, 45°, 90°, 135°, 180° (IoU moyen 0,80), HORS échantillon 20°, 70°, 110°, 160° (IoU moyen 0,82). Départ annoté : 0,71 / 0,73.
  hairline: { knots: [[0, 0.205], [25, 0.2], [50, 0.26], [70, 0.49], [85, 0.52], [100, 0.48], [120, 0.74], [150, 0.81], [180, 0.846]] },
  // Palette échantillonnée sur la planche (médianes) : peau, cheveux, iris, bouche, encre.
  palette: { skin: '#fde7cd', skinShade: '#e6bca4', hair: '#f3e290', hairShade: '#e0cf7c', ink: '#493831', iris: '#6c87c0', irisDeep: '#2a3762', lip: '#d98f84', mouthIn: '#bd6c6e', blush: '#f9cdb5' },
};
