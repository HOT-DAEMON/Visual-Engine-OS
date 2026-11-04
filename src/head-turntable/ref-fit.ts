/* GÉNÉRÉ par scripts/head-turntable/fit-rotation.ts à partir de references/face/rotation_head.measures.json — ne pas modifier à la main. */
import type { Row } from './types';

/** Tangage de caméra ajusté sur les 9 vues (degrés) et résidus de l'ajustement rigide (unités U ; 1 U = 150 px de la planche). */
export const REF_PITCH = 17.73;
export const REF_RESIDUAL = { eye: 0.0121, mouth: 0.0063, observations: 26 } as const;

/** Repères ajustés (tête à plat) : yeux, bouche, bout du nez (profondeur z = avancée max. du profil de 90°). */
export const REF_FIT = {
  eye: { x: 0.1696, y: 0.6291, z: 0.3859 },
  mouth: { y: 0.8611, z: 0.373 },
  noseTip: { y: 0.7349, z: 0.5267 },
} as const;

/** Table de sections (y, a, zf, zb), pas de 0,05 U (0,025 aux extrémités) : sommet → bas du menton. */
export const REF_ROWS: readonly Row[] = [
  { y: 0, a: 0, zf: 0.037, zb: 0.037 },
  { y: 0.025, a: 0.126, zf: 0.18, zb: -0.109 },
  { y: 0.05, a: 0.207, zf: 0.272, zb: -0.195 },
  { y: 0.075, a: 0.247, zf: 0.32, zb: -0.23 },
  { y: 0.1, a: 0.273, zf: 0.351, zb: -0.25 },
  { y: 0.125, a: 0.294, zf: 0.379, zb: -0.271 },
  { y: 0.15, a: 0.315, zf: 0.407, zb: -0.293 },
  { y: 0.2, a: 0.337, zf: 0.435, zb: -0.315 },
  { y: 0.25, a: 0.358, zf: 0.457, zb: -0.336 },
  { y: 0.3, a: 0.371, zf: 0.471, zb: -0.352 },
  { y: 0.35, a: 0.379, zf: 0.48, zb: -0.361 },
  { y: 0.4, a: 0.381, zf: 0.484, zb: -0.364 },
  { y: 0.45, a: 0.383, zf: 0.484, zb: -0.363 },
  { y: 0.5, a: 0.383, zf: 0.479, zb: -0.357 },
  { y: 0.55, a: 0.376, zf: 0.472, zb: -0.344 },
  { y: 0.6, a: 0.358, zf: 0.465, zb: -0.324 },
  { y: 0.65, a: 0.334, zf: 0.461, zb: -0.297 },
  { y: 0.7, a: 0.307, zf: 0.459, zb: -0.262 },
  { y: 0.75, a: 0.283, zf: 0.456, zb: -0.208 },
  { y: 0.8, a: 0.264, zf: 0.452, zb: -0.103 },
  { y: 0.85, a: 0.248, zf: 0.449, zb: 0.06 },
  { y: 0.9, a: 0.21, zf: 0.445, zb: 0.2 },
  { y: 0.95, a: 0.185, zf: 0.437, zb: 0.29 },
  { y: 1, a: 0.15, zf: 0.405, zb: 0.335 },
  { y: 1.025, a: 0.105, zf: 0.392, zb: 0.34 },
  { y: 1.04, a: 0.055, zf: 0.381, zb: 0.335 },
  { y: 1.05, a: 0, zf: 0.373, zb: 0.33 },
];
