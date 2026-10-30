import { z } from 'zod';
import { Unit } from '../schema/primitives';

/**
 * CONTRAT DU MOTEUR DE CORPS (membre supérieur + tronc), VUE DE FACE — `src/body/`.
 *
 * Le corps est l'ENFANT du cou : il ne porte aucune coordonnée absolue, tout est calculé depuis un `NeckAnchor` (base du cou, largeur du
 * cou, hauteur de tête `h` = unité de mesure). Les axes ci-dessous sont INDÉPENDANTS les uns des autres : âge, sexe, adiposité et
 * musculature sont quatre axes distincts (aucun n'est couplé à une « origine » ni à un autre axe) ; ce qui les relie (ex. dimorphisme
 * exprimé seulement après la puberté) est écrit dans `canon.ts` et vérifié, jamais caché dans un paramètre.
 * Repère : x > 0 = côté GAUCHE du corps (à droite de l'image), y vers le bas, unité = px de l'hôte de face (1 tête = `h` px).
 */
const Signed = z.number().min(-1).max(1);

/** Pose d'UN bras. Projection orthographique du plan frontal : la flexion du coude vers le spectateur RACCOURCIT l'avant-bras (perspective). */
export const ArmPose = z
  .object({
    /** Écart du bras par rapport au tronc dans le plan frontal (°). 0 = le long du corps. */
    abduction: z.number().min(0).max(85).default(10),
    /** Flexion du coude vers le spectateur (°) : 0 = bras tendu ; l'avant-bras se raccourcit de cos(flexion). */
    elbowFlex: z.number().min(0).max(100).default(8),
    /** Rotation de l'avant-bras dans le plan de l'image (°), pour mains sur les hanches, bras croisés, etc. */
    forearmSwing: z.number().min(-90).max(90).default(0),
    /** Déviation du poignet dans le plan de l'image (°). */
    wristDev: z.number().min(-30).max(30).default(0),
    /** Rotation de l'avant-bras : -1 paume vers l'avant (position anatomique) · 0 tranche (pouce devant) · +1 dos de la main vers l'avant. */
    pronation: Signed.default(-0.35),
    /** Écartement des doigts (0 = serrés, 1 = très écartés). */
    spread: Unit.default(0.25),
    /** Flexion de chaque doigt [pouce, index, majeur, annulaire, auriculaire] : 0 = tendu, 1 = fermé en poing. */
    curl: z.array(Unit).length(5).default([0.18, 0.22, 0.28, 0.34, 0.4]),
  })
  .strict();
export type ArmPose = z.infer<typeof ArmPose>;

export const BodyParams = z
  .object({
    /** Âge en années (0 = nouveau-né … 95). Pilote les proportions (canon par âge) et les portes de puberté / vieillesse. */
    age: z.number().min(0).max(95).default(30),
    /** Axe sexuel : -1 féminin … +1 masculin. Exprimé seulement après la puberté (porte `puberty`) ; avant, aucun effet sur la silhouette. */
    sex: Signed.default(1),
    /** Adiposité : 0 très maigre … 1 obèse. */
    adiposity: Unit.default(0.3),
    /** Musculature : 0 atrophié … 1 culturiste. Visibilité réelle = musculature × (1 − adiposité masquante) × âge. */
    muscularity: Unit.default(0.35),
    /** Écarts de charpente par rapport au canon de l'âge (±1 ≈ ±12 %). Chacun indépendant. */
    frame: z.object({ shoulderWidth: Signed.default(0), clavicleSlope: Signed.default(0), trapezius: Signed.default(0), chest: Signed.default(0), waist: Signed.default(0), hip: Signed.default(0), torsoLength: Signed.default(0) }).strict().default({}),
    /** Écarts des membres (±1 ≈ ±12 %). */
    limbs: z.object({ upperArm: Signed.default(0), forearm: Signed.default(0), hand: Signed.default(0), palmWidth: Signed.default(0), armThickness: Signed.default(0), wristThickness: Signed.default(0), thumb: Signed.default(0) }).strict().default({}),
    /** Longueur de chaque doigt [pouce, index, majeur, annulaire, auriculaire] : écart ±1 ≈ ±15 %. */
    fingers: z.array(Signed).length(5).default([0, 0, 0, 0, 0]),
    /** Seins (adultes seulement : rien n'est dessiné avant 18 ans). */
    breast: z.object({ volume: Unit.default(0.5), ptosis: Unit.default(0.3), spacing: Signed.default(0), projection: Unit.default(0.5) }).strict().default({}),
    /** Posture : chute des épaules et cyphose (s'ajoute à l'effet de l'âge). */
    posture: z.object({ shoulderDrop: Signed.default(0), kyphosis: Unit.default(0) }).strict().default({}),
    /** Poses des deux bras (indépendantes : asymétrie libre). `left` = côté gauche du corps = à droite de l'image. */
    pose: z.object({ left: ArmPose.default({}), right: ArmPose.default({}) }).strict().default({}),
  })
  .strict();
export type BodyParams = z.infer<typeof BodyParams>;
export type BodyInput = z.input<typeof BodyParams>;

/** Ancre fournie par le PARENT (le cou) : c'est tout ce que le corps sait du visage. */
export interface NeckAnchor {
  /** Hauteur de tête (sommet → menton), px : unité de toutes les proportions du corps. */
  readonly h: number;
  readonly chinY: number;
  /** Ordonnée de la base du cou (jonction cou / trapèzes). */
  readonly baseY: number;
  /** Demi-largeur du cou à sa base, évasement compris. */
  readonly baseHalf: number;
}

export interface V { readonly x: number; readonly y: number }
export type Side = 'L' | 'R' | 'C';
export type AtomKind = 'skin' | 'muscle' | 'fat' | 'bone' | 'landmark' | 'line' | 'nail';
/**
 * Niveau de présentation (hiérarchie d'affichage) : 0 enveloppes (silhouette) · 1 masses majeures · 2 muscles individuels et
 * segments osseux · 3 repères et micro-détails (ongles, plis, articulations, mamelon…).
 */
export type Level = 0 | 1 | 2 | 3;

/** Un ATOME : la plus petite unité nommée du corps. Polygone de contrôle fermé (ou polyligne si `open`), lisse à l'affichage. */
export interface Atom {
  readonly id: string;
  readonly kind: AtomKind;
  /** Composant du contrat qui l'a produit (voir `contracts.ts`). */
  readonly part: string;
  /** Atome parent (hiérarchie anatomique) ; `null` pour la racine. */
  readonly parent: string | null;
  readonly level: Level;
  readonly side: Side;
  readonly poly: readonly V[];
  readonly open?: boolean;
  /** `front` : visible de face ; `occluded` : existe mais caché (dessiné seulement en mode `atoms`). */
  readonly view: 'front' | 'occluded';
  /** Ordre de peinture (croissant = au-dessus). */
  readonly z: number;
  /** Décalage de ton (-1 ombre … +1 lumière) pour les masses. */
  readonly tone?: number;
  /** Palier musculaire (0…5) à partir duquel l'atome apparaît (voir `muscle-tiers.ts`) ; absent = toujours montré. */
  readonly tier?: number;
}
