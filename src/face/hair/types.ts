import type { Vec } from '../../geometry/eye/primitives';
import type { HairTexture } from '../../schema';
import type { Poly } from '../poly';

/** `main` : mèche principale (large) ; `fine` : mèche secondaire (fine, reflets) ; `plait` : segment de tresse. */
export type LockRank = 'main' | 'fine' | 'plait';

export interface HairLock {
  readonly poly: Poly;
  readonly rank: LockRank;
  /** Écart de teinte relatif : < 0 plus sombre, > 0 plus clair (−1…1). */
  readonly tone: number;
  readonly layer: 'front' | 'back';
  /** Contour sombre fin (mèches principales, segments de tresse). */
  readonly edge: boolean;
}

/** Zones où le cuir chevelu reste visible (raie, éclaircissement) : dessinées sur la sous-couche, sous les mèches. */
export interface BareScalp {
  readonly part: Poly | null;
  readonly thin: Poly[];
}

/**
 * Chevelure : GÉOMÉTRIE PURE lue par le rendu ET par les tests. Tout dérive des repères du visage
 * (naissance, contour du crâne, sourcils) : la chevelure est une enfant du visage et ne porte aucune coordonnée propre.
 */
export interface HairGeometry {
  readonly texture: HairTexture;
  /** Ligne d'implantation, de la tempe gauche à la tempe droite (repère de l'hôte). */
  readonly hairline: Vec[];
  /** Zone du cuir chevelu (ligne d'implantation → contour du crâne). */
  readonly scalp: Poly;
  /** Sous-couche racine (volume dense sous les mèches) — AVANT. */
  readonly base: Poly[];
  readonly bare: BareScalp;
  readonly locks: HairLock[];
  /** Masse arrière (bob/long) : silhouette sombre derrière la tête. */
  readonly backBase: Poly | null;
  /** Tout ce qui est dessiné APRÈS la tête (sous-couche + mèches avant) : zone testée contre les yeux. */
  readonly front: Poly[];
  /** Tout ce qui est dessiné AVANT la tête (queue, chignon, tresses, mèches arrière). */
  readonly back: Poly[];
  /** Bord inférieur de la frange (de droite à gauche), ou null. */
  readonly fringeBottom: Vec[] | null;
  /** Points d'attache (élastiques) : position et vrai si au-dessus du crâne (visible, dessiné devant). */
  readonly ties: { readonly at: Vec; readonly rx: number; readonly front: boolean }[];
}
