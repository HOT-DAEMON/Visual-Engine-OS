import type { Correction } from '../core/resolve';
import type { NeckSystem } from '../schema/neck-system';

/**
 * TYPES DU MOTEUR DE COU — les six objets de données distincts du TODO §8 (jamais une classe unique qui porte tout).
 * Repère : celui du visage (px, origine au centre de la tête, y vers le bas, x vers la droite de l'image, z vers le spectateur).
 */
export interface P2 { readonly x: number; readonly y: number }
export interface P3 { readonly x: number; readonly y: number; readonly z: number }

/** Ce que le cou lit de la tête (px). Fourni par le moteur de visage ; le cou n'invente aucun repère de tête. */
export interface HeadContext {
  readonly W: number;
  readonly H: number;
  readonly chinY: number;
  /** Ordonnée de l'angle de la mâchoire : départ visible des muscles du cou. */
  readonly jawY: number;
  readonly chinHalf: number;
  /** Demi-largeur du contour de la tête au haut du cou et à la mâchoire : le cou reste DERRIÈRE la tête au-dessus de la mâchoire. */
  readonly headHalfTop: number;
  readonly headHalfJaw: number;
  /** Projection du menton (0–1) : lue seulement si `FaceNeck.chinCoupling` > 0. */
  readonly chinProjection: number;
  /** Inclinaison de la tête (degrés, + = menton vers le bas) : source `deform.articulation.headPitchDeg`. */
  readonly headPitchDeg: number;
  /** Rotation de la tête autour de l'axe vertical (degrés) : source = moteur de pose. 0 = de face. */
  readonly headYawDeg: number;
  /** Ouverture de la mandibule 0–1 et serrage 0–1 (lus par le platysma). */
  readonly jawOpen: number;
  readonly clench: number;
  /** Sexe exprimé du corps attaché (−1 féminin … +1 masculin ; 0 = indéterminé) : lu SEULEMENT par les reliefs du larynx. Ne modifie ni les stations ni le rig. */
  readonly sex: number;
}

/** Paramètres plats existants de `FaceNeck` (source unique de largeur, longueur, évasement…). */
export interface FaceNeckParams {
  readonly visible: boolean;
  readonly width: number;
  readonly length: number;
  readonly flare: number;
  readonly shade: number;
  readonly cervicomentalDeg: number;
  readonly thickness: number;
  readonly muscles: number;
  readonly platysma: number;
  readonly chinCoupling: number;
  readonly system?: NeckSystem;
}

/** NeckMorphology : dimensions, section, courbure, proportions, asymétrie et limites (valeurs RÉSOLUES, en px). */
export interface NeckMorphology {
  readonly topY: number;
  readonly bottomY: number;
  readonly lengthPx: number;
  readonly aTop: number;
  readonly aBase: number;
  readonly depthRatio: number;
  /** Demi-profondeur du haut (px) : `frame.depthHalf × depthRatio`. */
  readonly bTop: number;
  /** Début de l'évasement (fraction de la longueur) : suit le bas RÉEL du menton. */
  readonly flareStart: number;
  readonly taper: number;
  /** Volume du trapèze 0–1 : règle la convexité de la pente nuque → épaule (0,5 = profil historique). */
  readonly trapezius: number;
  readonly waist: number;
  readonly curvature: number;
  readonly sCurve: number;
  /** Exposant de la section : 2 = ellipse, > 2 = rectangle arrondi. */
  readonly sectionExp: number;
  readonly segments: number;
  readonly pitchDeg: number;
  readonly rollDeg: number;
  readonly torsionDeg: number;
  readonly axisOffsetPx: number;
  readonly lrBias: number;
  readonly fbBias: number;
  readonly variation: number;
  readonly seed: number;
  readonly mass: number;
  readonly age: number;
  readonly angularity: number;
  readonly corrections: readonly Correction[];
}

/** Station le long de l'axe : centre, section (demi-largeurs gauche/droite, demi-profondeurs avant/arrière), torsion. */
export interface Station {
  readonly u: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly aL: number;
  readonly aR: number;
  readonly bF: number;
  readonly bB: number;
  readonly n: number;
  readonly twist: number;
  /** Indice de segment (0…segments−1) ; sert à la cuirasse et aux anneaux. */
  readonly seg: number;
}

export type JointId = 'C0-C1' | 'mid' | 'C7-T1';
/** NeckRig : articulations, axes, limites de mouvement et stratégie de déformation. */
export interface NeckRig {
  readonly joints: readonly { readonly id: JointId; readonly u: number; readonly limits: { readonly pitch: readonly [number, number]; readonly yaw: readonly [number, number]; readonly roll: readonly [number, number] } }[];
  readonly strategies: readonly string[];
  /** Part de la rotation de la tête suivie par le cou (M03). */
  readonly twistShare: number;
}

export type StructureId =
  | 'axial' | 'joints' | 'scm' | 'trapezius' | 'platysma-infrahyoid' | 'larynx' | 'trachea' | 'hyoid' | 'vessels' | 'clavicle' | 'fat-folds' | 'skin';
/** Système principal du TODO (« sept systèmes ») auquel appartient une structure. */
export type NeckSystemId = 'skeleton' | 'muscle' | 'tissue' | 'outer-geometry' | 'deformation' | 'material' | 'species';
export interface Structure {
  readonly id: StructureId;
  readonly system: NeckSystemId;
  /** Visibilité effective 0–1 (dérivée de morphologie, posture, corpulence, espèce ; ou forcée par `reliefs`). */
  readonly visibility: number;
  /** Raison de l'absence (espèce, style) quand `visibility` = 0 par règle et non par valeur. */
  readonly disabledBy?: string;
}

/** NeckDeformationStack : opérateurs appliqués, dans l'ordre RÉEL d'exécution, avec leurs limites. */
export interface AppliedOperator { readonly op: string; readonly amount: number; readonly at: number; readonly span: number; readonly side: number; readonly order: number; readonly clamped: boolean }
export interface NeckDeformationStack { readonly applied: readonly AppliedOperator[]; readonly corrections: readonly Correction[] }

/** Champs de déformation par station : ce que les opérateurs écrivent et que les reliefs/plis lisent (la géométrie RÉAGIT). */
export interface DeformFields {
  /** Compression locale 0–1 par station (déclenche plis et déplacement des tissus mous). */
  readonly compression: Float64Array;
  /** Gonflement musculaire local ≥ 0. */
  readonly muscle: Float64Array;
  /** Ondulation de surface (px). */
  readonly ripple: Float64Array;
  /** Amplification des plis (≥ 1). */
  readonly fold: Float64Array;
  /** Côté comprimé par station, −1 = gauche de l'image … +1 = droite (inclinaison latérale, rotation) : les plis se forment de CE côté. */
  readonly compressionSide: Float64Array;
  /** Côté dont le sterno-cléido-mastoïdien est tendu, −1 … +1 (le muscle CONTROLATÉRAL à la rotation se tend). */
  readonly muscleSide: Float64Array;
  /** Simplification de silhouette 0–1 (atténue les détails). */
  readonly simplify: number;
}

/** NeckSurfaceProfile : matériau, motif, détails de surface et leur réaction aux déformations (valeurs résolues). */
export interface NeckSurfaceProfile {
  readonly pattern: NeckSystem['surface']['pattern'];
  readonly layout: NeckSystem['surface']['layout'];
  readonly sizePx: number;
  readonly density: number;
  readonly overlap: number;
  readonly variation: number;
  readonly smoothThroat: number;
  readonly skinTension: number;
  readonly elementColor: string | null;
}

export interface Anchor { readonly id: string; readonly u: number; readonly psi: number }
/** NeckAttachmentGraph : relations avec la tête, le thorax, les épaules, les accessoires et les éléments additionnels. */
export interface NeckAttachmentGraph {
  readonly parent: 'head';
  readonly children: readonly string[];
  readonly anchors: readonly Anchor[];
  readonly attachments: readonly NeckSystem['attachments'][number][];
}

/** NeckComposition : le cou complet — il compose les cinq objets ci-dessus et ne contient AUCUNE géométrie propre. */
export interface NeckComposition {
  readonly species: NeckSystem['species'];
  readonly style: NeckSystem['style']['mode'];
  readonly morphology: NeckMorphology;
  readonly rig: NeckRig;
  readonly stack: NeckDeformationStack;
  readonly surface: NeckSurfaceProfile;
  readonly graph: NeckAttachmentGraph;
  readonly structures: readonly Structure[];
}

/** Modèle résolu : composition + géométrie dérivée (stations déformées). Toutes les vues en sont des PROJECTIONS. */
export interface NeckModel {
  readonly ctx: HeadContext;
  readonly composition: NeckComposition;
  readonly stations: readonly Station[];
  readonly fields: DeformFields;
  readonly corrections: readonly Correction[];
}
