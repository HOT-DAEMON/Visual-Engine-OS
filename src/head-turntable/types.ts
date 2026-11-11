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
/**
 * Vue : lacet, tangage de caméra et ROULIS de la tête (° ; > 0 = la tête s'incline vers la DROITE de l'image, sens horaire vu de face). Le roulis est une inclinaison latérale autour de l'axe
 * du nez (z de la tête), appliquée AVANT le lacet : de profil, la tête s'incline donc vers ou loin de la caméra. `rig` (pivots, calculé par `rollRig`) accompagne tout roulis non nul.
 */
export interface View { readonly yaw: number; readonly pitch: number; readonly roll?: number; readonly rig?: RollRig }
/** Chaîne cou-tête du roulis : `T` = haut du cou (pivot de l'articulation occipitale), `B` = base du cou (pivot du pli du cou), `bend` = part du roulis prise par la flexion du cou (rad), `roll` total (rad). */
export interface RollRig { readonly T: V3; readonly B: V3; readonly bend: number; readonly roll: number }

/** Une section horizontale du crâne/mâchoire à la hauteur y : demi-largeur a, face avant zf, face arrière zb (ellipse de centre (zf+zb)/2). */
/**
 * Rangée de la table de sections : demi-largeur `a`, avant `zf`, arrière `zb`. Champs OPTIONNELS de forme (absents = ellipse, comportement d'origine) :
 * `zw` profondeur du point le plus large (mâchoire : au coin gonial, loin derrière le centre) ; `pf` exposant de PROFONDEUR de la moitié avant, `qf` exposant de
 * LARGEUR. Moitié avant : x = a·sin(φ)^(2/qf), z = zw + (zf − zw)·cos(φ)^(2/pf). (pf, qf) = (2, 2) ellipse ; (1, 2) parabole en U ; (1, 1) V ; (3, 3) carré arrondi.
 * `pb` / `qb` : mêmes exposants pour la moitié ARRIÈRE (z = zw − (zw − zb)·|cos φ|^(2/pb), x = a·|sin φ|^(2/qb)) ; > 2 = occiput aplati (brachycéphale), < 2 = occiput pointu. Absents = demi-ellipse.
 */
export interface Row { readonly y: number; readonly a: number; readonly zf: number; readonly zb: number; readonly zw?: number; readonly pf?: number; readonly qf?: number; readonly pb?: number; readonly qb?: number }

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
  /** Yeux RÉELS de l'hôte (forme de l'ouverture, taille, iris, pupille, regard), en U dans le repère de la tête : quand ils sont fournis, ils remplacent les yeux de la planche. */
  readonly eyeHost?: HostEyes;
}

/** Un œil de l'hôte en U, repère de la tête à plat, `x` = |x| (le côté gauche est miroité : x croît vers l'extérieur du visage). */
export interface HostEye {
  /** Paupière supérieure puis inférieure, du canthus interne au canthus externe (polylignes). */
  readonly upper: readonly { x: number; y: number }[]; readonly lower: readonly { x: number; y: number }[];
  /** Centre de l'iris (regard compris) et demi-axes. */
  readonly iris: { cx: number; cy: number; rx: number; ry: number };
  /** Pupille : un contour par pupille (forme réelle : ronde, fente, étoile…), RELATIF au centre de l'iris, et sa teinte. Aucun contour = pupille masquée. */
  readonly pupil: { readonly contours: readonly (readonly { x: number; y: number }[])[]; readonly color: string };
  /** Sourcil de l'hôte au-dessus de cet œil (absent = l'hôte n'a pas de sourcil de ce côté) : voir `HostBrow`. */
  readonly brow?: HostBrow;
}
/**
 * Sourcil de l'hôte en U, même repère que `HostEye` (x = |x|, y vers le bas) : contour FERMÉ de `geometry/eye/browGeometry` (bord supérieur tête → queue, puis bord inférieur queue → tête),
 * `line` = ligne médiane (tête → queue) et `widths` = épaisseur locale (U) en chaque point de `line`, `color` = teinte dominante du matériau du sourcil.
 */
export interface HostBrow { readonly outline: readonly { x: number; y: number }[]; readonly line: readonly { x: number; y: number }[]; readonly widths: readonly number[]; readonly color: string }
/** `right` : côté x > 0 de la vue de face (œil droit du dessin) ; `left` : côté x < 0. */
export interface HostEyes { readonly right: HostEye; readonly left: HostEye }

/** Résultat d'un rendu : pixels RGBA, SVG autonome (PNG incrusté) et tampon d'identifiants pour la vérification. */
export interface TurnRender {
  readonly w: number; readonly h: number; readonly rgba: Uint8ClampedArray;
  readonly svg: string;
  /** Identifiant de partie par pixel (0 = fond) et région peinte (0 fond, 1 peau, 2 cheveux, 3 œil, 4 bouche, 5 oreille, 6 cou, 7 sourcil). */
  readonly ids: Uint8Array; readonly regions: Uint8Array;
  /** px par unité U, et position image du pivot (x = 0, y = 0 du repère tête). */
  readonly ppu: number; readonly originX: number; readonly originY: number;
}
export const REGION = { bg: 0, skin: 1, hair: 2, eye: 3, mouth: 4, ear: 5, neck: 6, brow: 7 } as const;
