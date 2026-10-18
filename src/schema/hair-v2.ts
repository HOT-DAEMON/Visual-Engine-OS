import { z } from 'zod';
import { Hex, Unit } from './primitives';
import { HAIR_TEXTURES } from './hair-system';

/**
 * Vocabulaire du moteur de cheveux v2 (formes, franges, côtés, occlusions, étages, pointes, épaisseurs).
 * TOUS les champs ont un défaut NEUTRE : une chevelure écrite avant la v2 se rend à l'identique tant
 * qu'on n'active rien. Les valeurs sont des fractions (Unit) de la largeur W / hauteur H de l'hôte.
 */

export const FLOW_MODES = ['classic', 'ribbons', 'cones', 'mixed'] as const;
/**
 * Forme des mèches. `ribbons` : grandes mèches larges et souples en S qui flottent loin du crâne ;
 * `cones` : paquets rigides, épais à la base, très pointus, orientés vers le haut / l'arrière ;
 * `mixed` : les deux ; `classic` : comportement d'avant (mèches courtes dirigées par la gravité).
 */
export const HairFlow = z
  .object({
    mode: z.enum(FLOW_MODES).default('classic'),
    /** Nombre de grandes mèches en S (0–14). */
    ribbons: z.number().int().min(0).max(14).default(0),
    /** Amplitude du S, fraction de la longueur de la mèche. */
    sWave: Unit.default(0.5),
    /** Nombre de paquets en cônes (0–12). */
    cones: z.number().int().min(0).max(12).default(0),
    /** Acuité des cônes (0 = pointe franche mais courte, 1 = aiguille). */
    coneSharp: Unit.default(0.8),
    /** Portée au-delà du crâne des mèches flottantes. */
    span: Unit.default(0.5),
    /** Anti-gravité : 0 = les mèches retombent, 1 = flottent sans gravité. */
    float: Unit.default(0.6),
    /** Mèches libres et volutes qui s'échappent de la masse (0–24). */
    wisps: z.number().int().min(0).max(24).default(0),
  })
  .strict();

/** Silhouette : asymétrie globale de l'enveloppe et gonflement des raides / ondulés. */
export const HairSilhouette = z
  .object({
    /** Volume gonflé : la masse dépasse largement le crâne (haut et côtés) pour TOUTES les textures. */
    puff: Unit.default(0),
    /** Force de l'asymétrie gauche/droite de l'enveloppe (0 = symétrique). */
    asymmetry: Unit.default(0),
    /** Côté le plus fourni : −1 = gauche de l'image, +1 = droite. */
    bias: z.number().min(-1).max(1).default(0),
    /** Part de la masse reportée au sommet (0 = plaqué, 1 = très haut). */
    lift: Unit.default(0),
  })
  .strict();

export const FRINGE_ENGINES = ['off', 'sheer', 'blades', 'wispy', 'asym_brow'] as const;
/**
 * Moteur de frange (remplace `fringe` quand ≠ 'off') :
 *  `sheer` : fils individuels, beaucoup de mèches fines, jours où la peau du front se voit ;
 *  `blades` : quelques grandes mèches triangulaires pointues avec un jour au centre ;
 *  `wispy` : mèches fines étagées, pointes très irrégulières ;
 *  `asym_brow` : frange asymétrique qui descend jusqu'au sourcil d'un seul côté.
 */
export const HairFringeEngine = z
  .object({
    mode: z.enum(FRINGE_ENGINES).default('off'),
    /** Part de jour (0 = rideau plein, 1 = très aéré) : surface de front visible. */
    gap: Unit.default(0.4),
    /** Nombre de mèches de la frange (0 = valeur par défaut du mode). */
    count: z.number().int().min(0).max(120).default(0),
    /** Côté du jour ou de la mèche longue : −1 / +1. */
    side: z.number().min(-1).max(1).default(1),
    /** Mèches latérales qui tombent le long de la joue, devant l'oreille. */
    cheekLocks: z.boolean().default(false),
  })
  .strict();

/** Racines relevées à la raie : elles se soulèvent puis retombent. */
export const HairRootLift = z
  .object({
    amount: Unit.default(0),
    /** Largeur de la zone relevée autour de la raie (fraction de W). */
    width: Unit.default(0.35),
    /** Retombée : 0 = reste dressé, 1 = retombe franchement. */
    fall: Unit.default(0.5),
  })
  .strict();

export const EAR_BEHAVIORS = ['auto', 'covered', 'free', 'tucked'] as const;
export const CHEEK_LOCKS = ['none', 'short', 'long'] as const;
/** Comportement des cheveux d'UN côté : l'oreille est cachée, dégagée ou la mèche est rangée derrière. */
export const HairSide = z.object({ ear: z.enum(EAR_BEHAVIORS).default('auto'), cheek: z.enum(CHEEK_LOCKS).default('none') }).strict();
export const HairSides = z.object({ left: HairSide.default({}), right: HairSide.default({}) }).strict();

/** Part du composant recouverte par des mèches PASSANT DEVANT (dessinées après les yeux). 0 = aucune. */
export const HairOcclusion = z
  .object({
    eyeLeft: Unit.default(0),
    eyeRight: Unit.default(0),
    brows: Unit.default(0),
    nose: Unit.default(0),
    mouth: Unit.default(0),
  })
  .strict();

/** Longueurs étagées par couche + sous-couches visibles. */
export const HairTiers = z
  .object({
    count: z.number().int().min(1).max(4).default(1),
    /** Raccourcissement d'un étage à l'autre (fraction de la longueur). */
    step: Unit.default(0.25),
    /** Ton des sous-couches (< 0 : plus sombre) et décalage de teinte (degrés). */
    underTone: z.number().min(-1).max(1).default(-0.35),
    underHue: z.number().min(-60).max(60).default(0),
    /** Opacité de la masse de sous-couche visible entre les mèches (0 = invisible). */
    underVisible: Unit.default(0),
  })
  .strict();

/** Pointes : irrégulières, retroussées vers l'extérieur, translucides. */
export const HairTips = z
  .object({
    irregular: Unit.default(0),
    flick: Unit.default(0),
    /** Fondu d'opacité vers la pointe (0 = opaque jusqu'au bout). */
    fade: Unit.default(0),
    /** Translucidité des bords latéraux. */
    edgeFade: Unit.default(0),
  })
  .strict();

/** Niveaux d'épaisseur : grosses masses, mèches moyennes (base), poils très fins (traits). */
export const HairStrands = z.object({ mass: Unit.default(0), fine: Unit.default(1), hairline: Unit.default(0) }).strict();

/** Mélange de textures dans une même tête : chaque mèche tire sa texture selon la zone et ces poids. */
export const HairTextureMix = z.array(z.object({ texture: z.enum(HAIR_TEXTURES), weight: Unit }).strict()).max(4);

/** Teinte propre à la chevelure : les couleurs d'ombre/lumière/dégradé viennent du moteur d'apparence. */
export const HairLook = z
  .object({
    /** Couleur de la pointe (dégradé racine → pointe) ; `null` : pas de dégradé imposé. */
    tipColor: Hex.nullable().default(null),
    /** Couleur intermédiaire optionnelle (dégradé à trois couleurs). */
    midColor: Hex.nullable().default(null),
    /** Part de la longueur de la mèche couverte par la transition (0 = très tôt, 1 = jusqu'à la pointe). */
    tipReach: Unit.default(0.6),
  })
  .strict();

export type HairFlow = z.infer<typeof HairFlow>;
export type HairSilhouette = z.infer<typeof HairSilhouette>;
export type HairFringeEngine = z.infer<typeof HairFringeEngine>;
export type HairRootLift = z.infer<typeof HairRootLift>;
export type HairSides = z.infer<typeof HairSides>;
export type HairOcclusion = z.infer<typeof HairOcclusion>;
export type HairTiers = z.infer<typeof HairTiers>;
export type HairTips = z.infer<typeof HairTips>;
export type HairStrands = z.infer<typeof HairStrands>;
export type HairLook = z.infer<typeof HairLook>;
