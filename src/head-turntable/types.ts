/**
 * TÊTE EN ROTATION (`src/head-turntable`) — contrat des types.
 *
 * Repère « tête à plat » : unité U = hauteur de tête mesurée sur la planche de rotation (150 px). x vers la DROITE de l'image quand le
 * lacet vaut 0 ; y vers le BAS depuis le sommet des cheveux ; z vers l'AVANT (le nez). Pivot de rotation = axe du cou (x = 0, z = 0).
 * La caméra est orthographique : lacet (rotation autour de la verticale de la tête) PUIS tangage de caméra (contre-plongée : la caméra est SOUS la tête,
 * elle voit le dessous du menton et le plan de coupe du cou, comme sur la planche).
 * Convention de la planche : lacet > 0 ⇒ le visage se tourne vers la GAUCHE de l'image (à 90° le nez pointe à gauche).
 */
export interface V3 { readonly x: number; readonly y: number; readonly z: number }

/** Vue : lacet de la tête et tangage de caméra, en degrés. */
export interface View { readonly yaw: number; readonly pitch: number }

/** Une section horizontale du crâne/mâchoire à la hauteur y : demi-largeur a, face avant zf, face arrière zb (ellipse de centre (zf+zb)/2). */
export interface Row { readonly y: number; readonly a: number; readonly zf: number; readonly zb: number }

export interface EyeSpec { readonly x: number; readonly y: number; readonly z: number; readonly w: number; readonly hUp: number; readonly hLo: number; readonly irisR: number }
export interface BrowSpec { readonly xIn: number; readonly xOut: number; readonly yIn: number; readonly yMid: number; readonly yOut: number; readonly thick: number }
/** Profil de face d'une bosse (nez, lèvres) : nœuds (y, z avant du profil à x = 0, demi-largeur). */
export type BumpKnots = readonly (readonly [number, number, number])[];
export interface NoseSpec { readonly rootY: number; readonly rootZ: number; readonly tipY: number; readonly tipZ: number; readonly baseY: number; readonly alaX: number; readonly rBridge: number; readonly rTip: number; readonly knots: BumpKnots }
export interface MouthSpec { readonly y: number; readonly z: number; readonly halfW: number; readonly open: number; readonly lipR: number; readonly knots: BumpKnots }
export interface EarSpec { readonly x: number; readonly y0: number; readonly y1: number; readonly z: number; readonly depth: number; readonly thick: number; readonly openDeg: number; readonly tiltDeg: number }
export interface NeckSpec { readonly a: number; readonly b: number; readonly zc: number; readonly y0: number; readonly y1: number }
/** Ligne d'implantation des cheveux : hauteur y de la lisière en fonction de l'azimut (0° = face, 90° = côté, 180° = nuque), symétrique. */
export interface HairlineSpec {
  readonly knots: readonly (readonly [number, number])[];
  /** Région exacte des cheveux (polygone dans le plan déroulé azimut° × y) : si elle est donnée, elle PRIME sur `knots` pour la peinture (`hair-region.ts`). */
  readonly region?: readonly (readonly [number, number])[];
}
export interface PaletteSpec { readonly skin: string; readonly skinShade: string; readonly hair: string; readonly hairShade: string; readonly ink: string; readonly iris: string; readonly irisDeep: string; readonly lip: string; readonly mouthIn: string; readonly blush: string }

import type { EngineHead } from './engines/face-model';

export interface HeadTurnSpec {
  readonly rows: readonly Row[];
  readonly eye: EyeSpec; readonly brow: BrowSpec; readonly nose: NoseSpec; readonly mouth: MouthSpec;
  readonly ear: EarSpec; readonly neck: NeckSpec; readonly hairline: HairlineSpec; readonly palette: PaletteSpec;
  /** Tête issue des moteurs existants (crâne, mâchoire, nez, bouche, oreille) : absente pour une spec purement mesurée. */
  readonly engine?: EngineHead;
}

/** Résultat d'un rendu : pixels RGBA, SVG autonome (PNG incrusté) et tampon d'identifiants pour la vérification. */
export interface TurnRender {
  readonly w: number; readonly h: number; readonly rgba: Uint8ClampedArray;
  readonly svg: string;
  /** Identifiant de partie par pixel (0 = fond) et région peinte (0 fond, 1 peau, 2 cheveux, 3 œil, 4 bouche, 5 oreille, 6 cou). */
  readonly ids: Uint8Array; readonly regions: Uint8Array;
  /** px par unité U, et position image du pivot (x = 0, y = 0 du repère tête). */
  readonly ppu: number; readonly originX: number; readonly originY: number;
}
export const REGION = { bg: 0, skin: 1, hair: 2, eye: 3, mouth: 4, ear: 5, neck: 6 } as const;
