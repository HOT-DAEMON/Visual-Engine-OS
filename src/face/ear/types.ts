import type { Vec } from '../../geometry/eye/primitives';
import type { EarExtensionKind, EarFamily, EarMaterialKind } from '../../schema/face-ear';
import type { Poly } from '../poly';

/**
 * TYPES DU MOTEUR D'OREILLE. Repère du PLAN de l'oreille (« plan ») : unité = hauteur de l'oreille, origine = coin antérieur-supérieur,
 * x vers l'arrière (bord de l'hélix), y vers le bas (lobule). Une oreille est un graphe de STRUCTURES dans ce plan, chacune avec un RELIEF
 * (hauteur au-dessus ou sous la plaque du pavillon, en unités d'épaisseur). Le MÊME graphe est projeté dans les quatre vues (`project.ts`).
 */
export type StructureId = 'helix' | 'antihelix' | 'scapha' | 'fossa' | 'cymba' | 'cavum' | 'tragus' | 'antitragus' | 'lobule' | 'canal' | 'crus';
export const STRUCTURES: readonly StructureId[] = ['helix', 'antihelix', 'scapha', 'fossa', 'cymba', 'cavum', 'tragus', 'antitragus', 'lobule', 'canal', 'crus'];
export type ConstraintTier = 'strict' | 'preference' | 'artistic';

/** Contrainte ayant ramené une valeur : `strict` = jamais violée ; `preference` = anatomique, levée par l'exagération ; `artistic` = signalée seulement. */
export interface EarCorrection {
  readonly id: string;
  readonly param: string;
  readonly requested: number;
  readonly applied: number;
  readonly reason: string;
  readonly tier: ConstraintTier;
}

/** Déviations morphologiques APLATIES (`pole.height`, `lobule.length`, `width`…) : la forme interne du moteur. */
export type FlatMorph = Record<string, number>;

export interface ResolvedEar {
  readonly side: -1 | 1;
  readonly weights: Readonly<Partial<Record<EarFamily, number>>>;
  readonly flat: FlatMorph;
  /** Rapport largeur/hauteur du CORPS du pavillon (avant pointes). */
  readonly widthRatio: number;
  readonly present: Readonly<Record<StructureId, boolean>>;
  readonly material: EarMaterialKind;
  readonly extensions: readonly { kind: EarExtensionKind; at: number; length: number; intensity: number }[];
  readonly corrections: readonly EarCorrection[];
}

/** Segment du contour (C01–C07) : indices [from, to[ dans `outline`, paramètres mesurés. */
export interface ContourSegment {
  readonly id: 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06' | 'C07';
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly lengthU: number;
}

/** Structure placée : polygone (plan), relief signé (unités d'épaisseur) et rôle. */
export interface PlacedStructure {
  readonly id: StructureId | string;
  readonly kind: 'ridge' | 'cavity' | 'blob' | 'band' | 'ext';
  readonly poly: Poly;
  readonly relief: number;
  readonly ext?: EarExtensionKind;
}

/** Point d'attache d'un bijou (plan) : position, orientation de pose (degrés), compatibilité avec la forme de l'oreille. */
export interface PiercingAnchor {
  readonly kind: 'ear_lobe_piercing' | 'helix_piercing' | 'tragus_piercing' | 'conch_piercing' | 'industrial_piercing';
  readonly at: Vec;
  readonly end?: Vec;
  readonly angleDeg: number;
  readonly compatible: boolean;
}

/** Modèle d'oreille complet, en coordonnées du plan : unique source du rendu, des vues, des mesures et de la vérification. */
export interface EarModel {
  readonly side: -1 | 1;
  readonly resolved: ResolvedEar;
  readonly widthRatio: number;
  /** Contour fermé (plan) et ses sept segments. */
  readonly outline: Poly;
  readonly segments: readonly ContourSegment[];
  readonly structures: readonly PlacedStructure[];
  /** Repères (plan) : `crus` (racine de l'hélix), `lobuleBottom`, `top`, `tragus`, `canal`… */
  readonly landmarks: Readonly<Record<string, Vec>>;
  readonly anchors: readonly PiercingAnchor[];
  /** Épaisseur du pavillon (unités de hauteur). */
  readonly thickness: number;
  readonly corrections: readonly EarCorrection[];
}
