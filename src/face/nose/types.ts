import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';

/**
 * Géométrie PURE du nez (aucun SVG), repère local de l'hôte, en pixels. Chaque sous-composant anatomique a sa propre structure :
 * le rendu (`render/face/nose/`), la vérification (`verify/`) et les ombres de contact lisent EXACTEMENT les mêmes nombres.
 */

/** Racine (nasion) : où le nez naît entre les orbites. `depthPx` = enfoncement naso-frontal (vu de profil). */
export interface NoseRootGeo {
  readonly y: number;
  readonly half: number;
  readonly depthPx: number;
}

/** Dorsum : ligne médiane (arête) et largeurs, échantillonnées de la racine (index 0) à la supra-pointe (dernier index). */
export interface NoseDorsumGeo {
  readonly axis: readonly Vec[];
  /** Demi-largeur de l'arête (la crête qui reçoit le reflet). */
  readonly half: readonly number[];
  /** Demi-largeur de la paroi (silhouette de la pyramide nasale, plus large que l'arête). */
  readonly wallHalf: readonly number[];
  /** Amplitude de la déviation latérale en S (px) ; 0 si le dorsum n'est pas asymétrique. */
  readonly deviationPx: number;
}

export interface NoseTipGeo {
  readonly c: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly poly: Poly;
  /** Avancée de la pointe devant le plan du visage (px, profil). */
  readonly projectionPx: number;
}

/** Une aile : volume fermé, avec son bord le plus saillant (`crest`), son point d'attache à la joue (`base`) et l'épaisseur du bord. */
export interface NoseAlaGeo {
  readonly side: -1 | 1;
  readonly poly: Poly;
  readonly crest: Vec;
  readonly outerX: number;
  readonly base: Vec;
  readonly thicknessPx: number;
}

/** Une narine : goutte orientée (axe incliné, sommet vers la ligne médiane). `a` = demi-axe long, `b` = demi-axe court. */
export interface NostrilGeo {
  readonly side: -1 | 1;
  readonly c: Vec;
  readonly a: number;
  readonly b: number;
  readonly tiltDeg: number;
  readonly poly: Poly;
}

/** Raccords avec le reste du visage : chaque courbe est une polyligne et porte la profondeur d'ombre qui lui correspond (0–1). */
export interface NoseJunctionsGeo {
  readonly glabella: { readonly c: Vec; readonly rx: number; readonly ry: number; readonly depth: number };
  readonly orbital: { readonly left: readonly Vec[]; readonly right: readonly Vec[]; readonly depth: number };
  readonly alarGroove: { readonly left: readonly Vec[]; readonly right: readonly Vec[]; readonly depth: number };
  readonly nasolabial: { readonly left: readonly Vec[]; readonly right: readonly Vec[]; readonly depth: number };
}

export interface NoseGeometry {
  /** Largeur totale des ailes (px). */
  readonly widthPx: number;
  readonly baseY: number;
  readonly root: NoseRootGeo;
  readonly dorsum: NoseDorsumGeo;
  readonly tip: NoseTipGeo;
  readonly alae: { readonly left: NoseAlaGeo; readonly right: NoseAlaGeo };
  readonly nostrils: { readonly left: NostrilGeo; readonly right: NostrilGeo };
  readonly columella: { readonly half: number; readonly topY: number; readonly bottomY: number };
  /** Profil vu de côté : x = avancée devant le plan du visage (px), y = hauteur ; du dessus de la racine à la lèvre supérieure. */
  readonly profile: readonly Vec[];
  readonly junctions: NoseJunctionsGeo;
  /** Silhouette de la pyramide nasale (racine → ailes → base), pour la mise en ombre et la vérification. */
  readonly silhouette: Poly;
}
