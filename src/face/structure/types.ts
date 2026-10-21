import type { Vec } from '../../geometry/eye/primitives';
import type { JawSilhouette } from '../jaw/structure';
import type { Poly } from '../poly';

/**
 * Géométrie PURE de la structure du visage (T3–T9) : une interface par famille de régions. Repère local de l'hôte, pixels.
 * Chaque région est un polygone ou une polyligne NOMMÉE : le rendu, la vérification et les artefacts lisent les mêmes sommets (aucun dessin « à la main »).
 */

/** Ellipse orientée (angle en degrés, sens horaire en repère SVG) : forme élémentaire des volumes mous. */
export interface Blob {
  readonly c: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly rotDeg: number;
}

/** Mandibule : les sept régions du cahier des charges (B) — corps, angle, branche, préauriculaire, bord inférieur, menton, joues qui la recouvrent. */
export interface MandibleGeo {
  /** Décomposition de la largeur de mâchoire : os, muscle, graisse, silhouette extérieure. */
  readonly silhouette: JawSilhouette;
  /** Branche montante (ramus) : du temple au coin de mâchoire (côté droit, de haut en bas). */
  readonly ramus: readonly Vec[];
  /** Angle mandibulaire (gonion) et sa mesure en degrés. */
  readonly gonion: Vec;
  readonly gonialDeg: number;
  /** Corps horizontal de la mandibule : du gonion au coin du menton (côté droit). */
  readonly body: readonly Vec[];
  /** Longueur du corps (px, gonion → coin du menton) : invariante quand seule la projection du menton change (voir `dependencies.ts`). */
  readonly bodyLengthPx: number;
  /** Bord inférieur COMPLET : du gonion gauche au gonion droit en passant par le menton. */
  readonly lowerBorder: readonly Vec[];
  /** Transition vers la région préauriculaire (devant l'oreille), côté droit puis gauche. */
  readonly preauricular: { readonly left: Poly; readonly right: Poly };
  /** Masséters (ellipses orientées le long de la branche) : relief visible des tissus qui recouvrent l'os. */
  readonly masseter: { readonly left: Blob; readonly right: Blob };
}

/** Régions du menton (D) : largeur, hauteur, projection, forme, symphyse, fossette, sillon, trois transitions. */
export interface ChinGeo {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly projectionPx: number;
  /** Rondeur mesurée : rapport largeur du méplat du bas / largeur au coin (0 = pointe, ~1 = carré). */
  readonly flatness: number;
  /** Symphyse : largeur (px) et profondeur verticale (px) effectives. */
  readonly symphysis: { readonly widthPx: number; readonly depthPx: number };
  readonly dimple: Blob;
  readonly groove: readonly Vec[];
  /** Transitions : supérieure (sillon labio-mentonnier), latérales (vers les joues antérieures, gauche/droite), inférieure (région sous-mentonnière). */
  readonly upper: Blob;
  readonly lateral: { readonly left: Blob; readonly right: Blob };
  readonly lower: Blob;
}

/** Tissus mous (E) et joues (G). */
export interface TissueGeo {
  readonly cheeks: { readonly left: CheekGeo; readonly right: CheekGeo };
  /** Tissu péri-labial : bande autour de la bouche (au-dessus de la lèvre supérieure, de part et d'autre des commissures, sous la lèvre inférieure). */
  readonly perioral: { readonly upper: Blob; readonly lower: Blob; readonly left: Blob; readonly right: Blob };
  /** Tissu sous-mentonnier : épaisseur (px) et zone sous le menton. */
  readonly submental: { readonly thicknessPx: number; readonly blob: Blob };
  /** Plis de base (avant déformation) : sillon nasogénien et pli péri-buccal (commissure → bas du menton), polylignes. */
  readonly folds: { readonly nasolabial: { readonly left: readonly Vec[]; readonly right: readonly Vec[] }; readonly perioral: { readonly left: readonly Vec[]; readonly right: readonly Vec[] } };
}

/** Une joue : pommette (os), volume (chair), creux sous la pommette, transition vers le masséter. */
export interface CheekGeo {
  readonly side: -1 | 1;
  readonly zygoma: Blob;
  readonly volume: Blob;
  readonly hollow: Blob;
  readonly masseterBlend: Blob;
  /** Largeur de la région latérale (px) : de la paroi du nez au contour. */
  readonly lateralWidthPx: number;
}

/** Cou (G) : angle cervico-mentonnier effectif, largeur, tissu sous-mandibulaire, muscles, tension du platysma. */
export interface NeckGeo {
  /** Angle cervico-mentonnier EFFECTIF (degrés) : de base, plus l'inclinaison de la tête et l'ouverture de la bouche. */
  readonly cervicomentalDeg: number;
  readonly halfWidthPx: number;
  readonly submentalBand: Blob;
  /** Sterno-cléido-mastoïdiens : polylignes de l'arrière de l'oreille vers la base du cou. */
  readonly scm: { readonly left: readonly Vec[]; readonly right: readonly Vec[] };
  /** Tension du platysma (0–1) : bouche ouverte et tête inclinée. */
  readonly platysmaTension: number;
  /** Profondeur de l'ombre portée du menton sur le cou, en px : croît quand l'angle cervico-mentonnier se ferme. */
  readonly shadowReachPx: number;
}

export interface StructureGeometry {
  readonly mandible: MandibleGeo;
  readonly chin: ChinGeo;
  readonly tissue: TissueGeo;
  readonly neck: NeckGeo;
}
