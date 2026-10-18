import type { ResolvedAppearance } from '../../../appearance';
import type { FaceLandmarks, NoseGeometry } from '../../../face';
import type { LightVector } from '../../../lighting/light';
import type { FaceParams } from '../../../schema';
import type { SoftKit } from '../soft';

/** Tout ce dont un sous-rendu du nez a besoin : géométrie, matériau (peau, apparence), lumière locale, échelle, formes douces. */
export interface NoseCtx {
  readonly id: string;
  readonly p: FaceParams;
  readonly lm: FaceLandmarks;
  readonly g: NoseGeometry;
  readonly skin: string;
  readonly ra: ResolvedAppearance;
  readonly L: LightVector;
  /** Direction 2D unitaire vers la lumière (repère local de l'hôte). */
  readonly dir: { readonly x: number; readonly y: number };
  /** Intensité effective de la lumière pour la peau (influence comprise). */
  readonly I: number;
  /** Échelle : pixels pour un visage de 300 px de large. */
  readonly u: number;
  readonly kit: SoftKit;
  readonly defs: string[];
}

export interface Layer {
  readonly markup: string[];
}
