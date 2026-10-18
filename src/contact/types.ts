import { num } from '../core/svg';
import type { Poly } from '../face/poly';
import type { ContactComponent, RimComponent } from '../schema';

/**
 * CONTRAT DU SOUS-MOTEUR D'OMBRES DE CONTACT ET DE LUMIÈRES DE CONTOUR.
 *
 * Un composant du visage (parent, enfant, frère) se déclare par un `FaceComponent` : son identité, son PARENT, sa silhouette, sa
 * hauteur au-dessus de la surface qui le porte et les surfaces (`receivers`) sur lesquelles il projette de l'ombre. Le sous-moteur
 * en tire les relations (parent, enfants, frères) et produit, pour chaque composant, son ombre de contact et sa lumière de contour.
 * Ajouter un composant futur (épaule, lunettes, boucle d'oreille…) = ajouter un `FaceComponent` : aucun autre code à modifier.
 */
export type ComponentId = string;

/**
 * `caster` : le composant est POSÉ sur le receveur (nez sur la joue) : l'ombre tombe à l'extérieur de sa silhouette.
 * `socket` : le composant est un CREUX dans le receveur (orbite, creux de l'oreille) : l'ombre tombe à l'intérieur, côté lumière.
 */
export type ComponentKind = 'caster' | 'socket';

export interface FaceComponent {
  readonly id: ComponentId;
  /** Parent dans l'arbre du visage ; `null` = racine (la tête). Les frères sont les composants de même parent. */
  readonly parent: ComponentId | null;
  readonly kind: ComponentKind;
  /** Silhouette (un ou plusieurs polygones, repère de l'hôte). */
  readonly polys: readonly Poly[];
  /**
   * Arêtes OUVERTES où se pose la lumière de contour, quand la silhouette contient des côtés artificiels (corde du menton, haut du cou,
   * coupe de la racine du nez). Absentes : tout le contour de `polys` porte le liseré.
   */
  readonly rimEdge?: readonly (readonly { x: number; y: number }[])[];
  /** `soft` : un creux sans bord physique net (orbite) — l'ombre n'est pas coupée par sa silhouette. `hard` (défaut) : bord réel (oreille). */
  readonly edge?: 'soft' | 'hard';
  /** Composant OPAQUE (dessiné par-dessus sa propre ombre : tête, lèvre, cheveux) : l'ombre n'a pas besoin d'être évidée sous lui. */
  readonly opaque?: boolean;
  /** Hauteur au-dessus de la surface porteuse (px) : décale l'ombre portée. */
  readonly depth: number;
  /** Surfaces sur lesquelles l'ombre est projetée (identifiants de receveurs, voir `Receivers`). */
  readonly receivers: readonly string[];
  /** Entrée du contrat d'éclairage qui règle ce composant (`schema/face-lighting.ts`) ; absente = pas d'ombre / de contour propre. */
  readonly contact?: ContactComponent;
  readonly rim?: RimComponent;
}

/** Surfaces receveuses : identifiant → chemin SVG (`d`) fermé. */
export type Receivers = Readonly<Record<string, string>>;

/** Chemin SVG fermé d'un polygone. */
export const polyD = (p: Poly): string => `M${p.map((v) => `${num(v.x)} ${num(v.y)}`).join('L')}Z`;
/** Chemin SVG de plusieurs polygones (sous-chemins). */
export const polysD = (ps: readonly Poly[]): string => ps.map(polyD).join('');
