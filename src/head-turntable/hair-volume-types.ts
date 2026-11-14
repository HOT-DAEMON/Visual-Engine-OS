/**
 * VOLUME DE CHEVEUX 3D de la tête en rotation (`docs/HAIR-VOLUME-3D.md`). Données pures (sérialisables, mémoïsables par contenu) : la forme est DÉRIVÉE de la silhouette
 * réelle de la coiffure du moteur de visage (`face/hair`), la rotation est CELLE DE LA TÊTE (`math.ts` : lacet, tangage, roulis) — aucune rotation propre aux cheveux.
 * Toutes les longueurs sont en U (repère de la tête à plat), y vers le bas depuis le sommet des cheveux de la planche.
 */

/** Pièce attachée, indépendante du crâne : chignon, queue, tresse. La position 3D est résolue par le maillage (`hair-parts.ts`) sur les sections du crâne. */
export type HairPart =
  | { readonly kind: 'bun'; readonly x: number; readonly y: number; readonly r: number; readonly place: HairPlace }
  | { readonly kind: 'tail'; readonly x: number; readonly y: number; readonly len: number; readonly r0: number; readonly spread: number; readonly place: HairPlace }
  | { readonly kind: 'braid'; readonly x: number; readonly y: number; readonly len: number; readonly r: number };

/** `top` : sur le dessus du crâne ; `side` : sur le contour latéral ; `back` : derrière la tête. */
export type HairPlace = 'top' | 'side' | 'back';

export interface HairVolume {
  readonly style: string;
  readonly texture: string;
  readonly seed: number;
  readonly curl: number;
  /** Rangées de la coque : hauteurs (U, croissantes). Le sommet peut être AU-DESSUS du crâne (y < 0). */
  readonly ys: readonly number[];
  /** Demi-largeur ABSOLUE de la silhouette de la coiffure à chaque rangée (U), côté gauche et droit de l'image : lue sur la silhouette 2D, lissée. */
  readonly rL: readonly number[];
  readonly rR: readonly number[];
  /** Part de l'épaisseur latérale reportée en profondeur : à l'avant (`kzF`) et à l'arrière (`kzB`). 1 = masse ronde, 0 = plaquée. */
  readonly kzF: number;
  readonly kzB: number;
  /** Cheveux pendants (bob, long) : rideau sous la nuque, de `y0` à `yEnd`, ouvert devant (|azimut| < `az0` degrés : le cou et le visage restent dégagés). */
  readonly hang: { readonly y0: number; readonly yEnd: number; readonly az0: number } | null;
  readonly parts: readonly HairPart[];
}
