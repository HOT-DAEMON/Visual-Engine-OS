import type { VaultRegion } from './vault-tissue';

/** Vues sous lesquelles une structure doit pouvoir être prouvée (mêmes identifiants que le banc d'essai `head-turntable/vault-lab.ts`). */
export type VaultView = 'face' | 'trois_quarts' | 'profil' | 'trois_quarts_arriere' | 'dos' | 'dessus';
/** Champ de la coupe (ou relief) sur lequel un paramètre agit : a demi-largeur, zf / zb profondeurs avant / arrière, pf qf pb qb exposants, y hauteur du sommet, relief déplacement radial. */
export type VaultField = 'a' | 'zf' | 'zb' | 'pf' | 'qf' | 'pb' | 'qb' | 'y' | 'relief';
export type VaultKind = 'bone' | 'region' | 'suture' | 'line' | 'landmark';

/** Position exacte d'une structure dans le repère de la tête : hauteur entre deux repères osseux (`SkullGeo.bone.lm`, décalée de `dy` U) ou hauteur fixe `yU`, azimut (° ; 0 = face, 90 = côté, 180 = nuque) et côté (0 = médian, ±1 = droite / gauche). Les coordonnées locales et globales sont calculées par `head-turntable/vault-visibility.ts`. */
export interface VaultAnchor { readonly from?: string; readonly to?: string; readonly t?: number; readonly dy?: number; readonly yU?: number; readonly az: number; readonly side: -1 | 0 | 1 }

/** Voisinage : les structures (ids de `COMPONENTS`, ou `NON_MODELED`) en contact dans chaque direction anatomique. Vide = rien (surface libre sous la peau). */
export interface VaultNeighbors { readonly superior: readonly string[]; readonly inferior: readonly string[]; readonly medial: readonly string[]; readonly lateral: readonly string[]; readonly posterior: readonly string[]; readonly anterior: readonly string[] }

export interface VaultInfluence { readonly fields: readonly VaultField[]; readonly yBand: readonly [number, number]; readonly azBand: readonly [number, number]; readonly views: readonly VaultView[] }

export interface VaultStructure {
  /** Identifiant anatomique = identifiant canonique de `src/anatomy/components.ts` (parent direct et parents lointains en sont lus, jamais recopiés). */
  readonly id: string;
  readonly fr: string; readonly latin: string; readonly kind: VaultKind;
  readonly region: VaultRegion;
  readonly neighbors: VaultNeighbors;
  readonly anchor: VaultAnchor;
  /** Paramètres de `SkullParams` qui agissent sur la structure. */
  readonly params: readonly string[];
  readonly influence: VaultInfluence;
  /** Présente dans le rendu par défaut ? (os et régions : oui ; sutures et lignes : données, rendues seulement avec `suturesShow`). */
  readonly visibleByDefault: boolean;
  /** Matériau : hérité du composant parent, ou spécialisé (ex. sillon de suture = peau amincie). */
  readonly material: { readonly inherits: string; readonly specialize?: string };
}

/** Structures citées en voisinage qui n'ont pas de composant canonique : pas de géométrie dans ce moteur (face interne, base du crâne). */
export const NON_MODELED = ['cranial-cavity', 'sphenoid-bone', 'zygomatic-arch'] as const;
export const N = (o: Partial<{ [K in keyof VaultNeighbors]: readonly string[] }>): VaultNeighbors => ({ superior: [], inferior: [], medial: [], lateral: [], posterior: [], anterior: [], ...o });
