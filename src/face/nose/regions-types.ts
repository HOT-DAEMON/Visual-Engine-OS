import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import type { NoseConstraint } from './constraints';

/**
 * Géométrie des RÉGIONS du nez ajoutées par T1 (suite de `types.ts`). Même règles : pure, en pixels, repère de l'hôte ;
 * le rendu, la vérification et les ombres de contact lisent EXACTEMENT ces nombres.
 */

/** Une paroi latérale : le quadrilatère courbe entre l'arête et le contour de la pyramide, plus sa gouttière (ligne de creux). */
export interface NoseSidewallGeo {
  readonly side: -1 | 1;
  readonly poly: Poly;
  /** Ligne médiane de la gouttière (creux de la paroi), de 35 % à 85 % de la hauteur du nez. */
  readonly gutter: readonly Vec[];
  /** Largeur moyenne de la paroi (px) : lue par la vérification (la pente la règle). */
  readonly meanWidthPx: number;
}

/** Un dôme alaire : bosse du lobule, contenue dans la pointe. */
export interface NoseDomeGeo {
  readonly side: -1 | 1;
  readonly c: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly poly: Poly;
}

/** Un sillon alaire : la portion du bord extérieur de l'aile qui reçoit le pli (de l'attache vers la pointe). */
export interface NoseGrooveGeo {
  readonly side: -1 | 1;
  readonly line: readonly Vec[];
  /** Prolongement vers la joue (transition aile → joue), polyligne ouverte. */
  readonly cheekBlend: readonly Vec[];
}

export interface NoseRegionsGeo {
  readonly sidewalls: { readonly left: NoseSidewallGeo; readonly right: NoseSidewallGeo };
  readonly domes: { readonly left: NoseDomeGeo; readonly right: NoseDomeGeo };
  readonly grooves: { readonly left: NoseGrooveGeo; readonly right: NoseGrooveGeo };
  /** Base du nez : plancher sous les narines (trapèze), demi-largeur au niveau des attaches. */
  readonly base: { readonly poly: Poly; readonly halfWidth: number; readonly y: number; readonly depthPx: number };
  /** Columelle : cloison (polygone), avec sa descente. */
  readonly columella: { readonly poly: Poly; readonly half: number; readonly topY: number; readonly bottomY: number };
  /** Narines : contour extérieur (rebord compris), ouverture (partie sombre) et rebord (anneau entre les deux). */
  readonly nostrils: { readonly left: NostrilRegionGeo; readonly right: NostrilRegionGeo };
  /** Philtrum : gouttière centrale entre la columelle et la lèvre, ses deux crêtes et la bande de transition avec la lèvre supérieure. */
  readonly philtrum: {
    readonly poly: Poly;
    readonly groove: readonly Vec[];
    readonly columns: { readonly left: readonly Vec[]; readonly right: readonly Vec[] };
    readonly lipBand: { readonly c: Vec; readonly rx: number; readonly ry: number };
    readonly lengthPx: number;
  };
  /** Contraintes anatomiques réellement appliquées (voir `constraints.ts`). */
  readonly constraints: readonly NoseConstraint[];
}

export interface NostrilRegionGeo {
  readonly side: -1 | 1;
  /** Contour extérieur (la goutte d'avant). */
  readonly outer: Poly;
  /** Ouverture sombre : inscrite dans le contour extérieur. */
  readonly aperture: Poly;
  /** Épaisseur du rebord (px). */
  readonly rimPx: number;
}
