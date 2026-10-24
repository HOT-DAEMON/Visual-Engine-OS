import type { Vec } from '../../geometry/eye/primitives';
import type { HairTexture } from '../../schema';
import type { Poly } from '../poly';

/**
 * ÉPAISSEUR : `mass` grosse masse ; `main` mèche moyenne ; `fine` mèche secondaire (fine, reflets) ;
 * `hairline` poil très fin (simple trait) ; `plait` segment de tresse.
 */
export type LockRank = 'mass' | 'main' | 'fine' | 'hairline' | 'plait';

/** FORME / rôle : mèche classique, grande mèche en S, cône rigide, volute libre, frange, mèche de joue, mèche qui passe devant. */
export type LockKind = 'lock' | 'flow' | 'cone' | 'wisp' | 'fringe' | 'cheek' | 'tuft' | 'occluder';

export interface HairLock {
  readonly poly: Poly;
  readonly rank: LockRank;
  /** Écart de teinte relatif : < 0 plus sombre, > 0 plus clair (−1…1). */
  readonly tone: number;
  /** `over` : dessiné APRÈS les yeux (mèche qui passe devant le visage). */
  readonly layer: 'front' | 'back' | 'over';
  /** Contour sombre fin (mèches principales, segments de tresse). */
  readonly edge: boolean;
  /** Forme / rôle (défaut `lock`). */
  readonly kind?: LockKind;
  /** Ligne médiane et profil du ruban : lus par le rendu (dégradé racine → pointe, bandes cel, ombre portée). */
  readonly spine?: Vec[];
  readonly w0?: number;
  readonly sharp?: number;
  readonly profile?: 'ribbon' | 'cone';
  /** Concavité du cône (profil `cone`). */
  readonly power?: number;
  /** Étage de longueur (0 = le plus long / le plus au fond). */
  readonly tier?: number;
  /** Fondu d'opacité vers la pointe et translucidité des bords (0–1). */
  readonly fade?: number;
  readonly edgeFade?: number;
  /** Mèche issue de la simulation : le drapé a déjà résolu les contacts ; `applySides` peut la passer derrière l'oreille. */
  readonly sim?: boolean;
  /** Masse de RÉGION (tempe+patte, mèche de joue, nuque) : sert aux limites par zone de la vérification. */
  readonly zone?: 'side' | 'cheek' | 'nape' | 'top';
}

/** Masse de sous-couche visible d'un étage : silhouette, ton relatif et décalage de teinte (degrés). */
export interface TierMass {
  readonly poly: Poly;
  readonly tier: number;
}

/** Mèche qui passe devant un composant du visage : cible, boîte du composant, recouvrement DEMANDÉ et mesuré. */
export interface OcclusionInfo {
  readonly target: 'eyeLeft' | 'eyeRight' | 'brows' | 'nose' | 'mouth';
  readonly box: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
  readonly requested: number;
  readonly measured: number;
}

/** Comportement résolu d'un côté : l'oreille est-elle cachée par les cheveux, et la zone de l'oreille (polygone). */
export interface SideInfo {
  readonly ear: 'covered' | 'free' | 'tucked';
  readonly cheek: 'none' | 'short' | 'long';
  readonly earZone: Poly;
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
  /** Dessiné APRÈS les yeux : mèches qui passent devant le visage (occlusions). */
  readonly over: Poly[];
  /** Sous-couches visibles par étage (silhouettes dessinées sous les mèches de l'étage). */
  readonly tierMasses: TierMass[];
  /** Occlusions réalisées (cible, boîte, recouvrement demandé / mesuré). */
  readonly occlusions: OcclusionInfo[];
  /** Comportement de chaque côté de l'IMAGE. */
  readonly sides: { readonly left: SideInfo; readonly right: SideInfo };
  /** Points d'attache (élastiques) : position et vrai si au-dessus du crâne (visible, dessiné devant). */
  /** Ombres portées des mèches sur la peau (cheveux simulés) ; vide sinon. */
  readonly skinShadows?: Poly[];
  /** Masse de volume des cheveux simulés (silhouette pleine dessinée sous les mèches), ou null. */
  readonly simMass?: Poly | null;
  /** Zones rasées (repousse sombre sur la peau) des cheveux simulés ; vide sinon. */
  readonly shaved?: Poly[];
  readonly ties: { readonly at: Vec; readonly rx: number; readonly front: boolean }[];
}
