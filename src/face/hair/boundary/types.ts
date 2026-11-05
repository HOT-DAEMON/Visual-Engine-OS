import type { Vec } from '../../../geometry/eye/primitives';
import type { Hairline } from '../hairline';
import type { SkullSurface, V3 } from './skull-surface';

/**
 * Les cinq tronçons de la LISIÈRE (bord du cuir chevelu qui porte des cheveux), dans l'ordre du parcours :
 *  - `front`    : implantation du front, de la tempe gauche à la tempe droite (forme, recul, irrégularité) ;
 *  - `sideburn` : bord avant de la patte, de la tempe vers le bas, jusqu'à la pointe de la patte (devant l'oreille) ;
 *  - `ear`      : de la pointe de la patte, au-dessus de l'oreille puis derrière elle jusqu'à la mastoïde ;
 *  - `nape`     : de la mastoïde à la ligne de la nuque, centrée derrière la tête.
 * Parcours fermé : front G→D, côté droit vers le bas, nuque D→G, côté gauche vers le haut.
 */
export type EdgeKind = 'front' | 'sideburn' | 'ear' | 'nape';

export interface BoundaryPoint {
  readonly kind: EdgeKind;
  /** Position SUR le crâne : ordonnée et azimut (0 = face, +π/2 = côté droit de l'image, π = nuque). */
  readonly y: number;
  readonly az: number;
  /** Projection de face (repère de l'hôte, px). Hors de l'hémisphère avant (|az| > π/2) : projection masquée. */
  readonly p: Vec;
}

/** Repères anatomiques (px, repère de l'hôte) lus par la construction ET par la vérification : une seule source. */
export interface HairMarks {
  readonly centerY: number;
  /** Ordonnée du coin de tempe de l'implantation (extrémité du tronçon `front`) et son azimut nominal. */
  readonly cornerY: { readonly left: number; readonly right: number };
  readonly azCorner: number;
  /** Pointe de la patte (bas du bord avant). */
  readonly tipY: number;
  readonly earTopY: { readonly left: number; readonly right: number };
  readonly earBottomY: { readonly left: number; readonly right: number };
  readonly napeY: number;
}

/** Bande des pattes : marge (px) entre le contour et le bord avant de la patte, à l'ordonnée y (0 sous la pointe). */
export interface SideburnProfile {
  readonly yT: number;
  readonly yTip: number;
  margin(y: number): number;
}

export interface HairBoundary {
  readonly loop: readonly BoundaryPoint[];
  /** Tronçon `front` exposé avec l'API historique (`pts`, `at`, `yAt`) : tout le moteur lit donc la MÊME ligne. */
  readonly hairline: Hairline;
  readonly marks: HairMarks;
  readonly sideburn: SideburnProfile;
  readonly skull: SkullSurface;
  /** Vrai si (x, y) de face est sur la PEAU DU VISAGE (sous l'implantation, hors de la bande des pattes, dans le contour) : les mèches n'y vont pas. */
  isFace(x: number, y: number): boolean;
  /** Points d'un tronçon (côté : −1 gauche de l'image, +1 droite ; sans côté : tous les points du tronçon, dans l'ordre du parcours). */
  segment(kind: EdgeKind, side?: -1 | 1): readonly BoundaryPoint[];
}

/** Repère de racine sur la lisière : position 3D, normale du crâne, direction d'écoulement (méridienne, du sommet vers la lisière). */
export interface RootFrame {
  readonly kind: EdgeKind;
  readonly pos: V3;
  readonly normal: V3;
  readonly flow: V3;
  /** Abscisse curviligne normalisée le long du parcours fermé (0…1). */
  readonly u: number;
}
