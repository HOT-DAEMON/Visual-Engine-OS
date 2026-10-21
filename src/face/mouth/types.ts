import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';

/**
 * Géométrie PURE de la bouche structurée (T7). Chaque élément du cahier des charges (F) est une structure à lui :
 * lèvres, arc de Cupidon + tubercule, commissures G/D, ouverture + cavité, dents sup./inf., gencives, langue, plis. Repère local de l'hôte, pixels.
 */
export interface MouthGeo {
  /** Commissures gauche et droite (de l'IMAGE), chacune à sa hauteur (asymétrie + expression). */
  readonly corners: { readonly left: Vec; readonly right: Vec };
  /** Demi-largeur effective (px) et largeur facteur par rapport à la bouche au repos (1 = repos). */
  readonly halfWidth: number;
  readonly widthScale: number;
  /** Ligne de fermeture (rima oris) de la commissure gauche à la droite : polyligne ordonnée en x. */
  readonly closure: readonly Vec[];
  /** Lèvre supérieure : contour fermé (bord haut avec arc de Cupidon, bord bas = ligne de fermeture relevée). */
  readonly upperLip: Poly;
  /** Lèvre inférieure : contour fermé (bord haut = ligne de fermeture + abaissement lié à la mandibule, bord bas arrondi). */
  readonly lowerLip: Poly;
  /** Arc de Cupidon : pics gauche/droite, creux central, et tubercule médian (bosse de la lèvre supérieure sur la ligne de fermeture). */
  readonly cupid: { readonly peakLeft: Vec; readonly peakRight: Vec; readonly dip: Vec; readonly tubercle: Vec };
  /** Cavité buccale (entre les lèvres) : vide si la bouche est fermée. */
  readonly cavity: Poly;
  /** Dents supérieures et inférieures (inférieures liées à la mandibule), gencive, langue : vides si non visibles. */
  readonly upperTeeth: Poly;
  readonly lowerTeeth: Poly;
  readonly gums: Poly;
  readonly tongue: Poly;
  /** Plis des tissus autour des commissures (déplacés par le champ de tissu de l'expression) : polylignes + profondeur 0–1. */
  readonly folds: { readonly left: readonly Vec[]; readonly right: readonly Vec[]; readonly depth: number };
  /** Hauteur maximale de la fente (px) et ordonnées de référence lues par les tests de dépendance. */
  readonly gapPx: number;
  readonly lowerTeethY: number;
  /** Haut des dents supérieures au centre (attaché au maxillaire : ne bouge PAS quand la mandibule s'abaisse). */
  readonly upperTeethTopY: number;
  readonly lowerLipBottomY: number;
  /** Surfaces des lèvres (px²) : mesure du maintien du volume. */
  readonly areas: { readonly upper: number; readonly lower: number };
}
