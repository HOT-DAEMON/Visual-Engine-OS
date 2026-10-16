import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * Compléments du visage complet : cou, cheveux, pilosité, asymétrie. Comme le reste de `FaceParams`,
 * TOUT est exprimé en fractions de la largeur `W` / hauteur `H` de l'hôte (mise à l'échelle sans
 * déformation) et les positions viennent de `face/landmarks.ts` : ces éléments sont des ENFANTS du
 * visage, ils ne portent aucune coordonnée propre. Les défauts reproduisent le visage d'avant
 * (cou masqué, crâne chauve, imberbe, parfaitement symétrique) : rien ne change tant qu'on ne les active pas.
 */
export const FaceNeck = z
  .object({
    visible: z.boolean().default(false),
    /** Largeur du cou, fraction de W (bornée entre le menton et la mâchoire par les repères). */
    width: z.number().min(0.2).max(0.8).default(0.42),
    /** Longueur sous le menton, fraction de H. */
    length: z.number().min(0.06).max(0.4).default(0.2),
    /** Élargissement du bas du cou (trapèzes), 0 = cylindre. */
    flare: z.number().min(0).max(0.6).default(0.25),
    /** Assombrissement du cou par rapport au visage (il est dans l'ombre du menton). */
    shade: Unit.default(0.5),
  })
  .strict();

export const HAIR_STYLES = ['bald', 'buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long'] as const;
export const HAIR_FRINGES = ['none', 'straight', 'sweep', 'curtain'] as const;

export const FaceHair = z
  .object({
    style: z.enum(HAIR_STYLES).default('bald'),
    color: Hex.default('#2b1d14'),
    /** Frange : tombe jusqu'au-dessus des sourcils, jamais dessus. */
    fringe: z.enum(HAIR_FRINGES).default('none'),
    /** Volume du crâne (0 = plaqué, 1 = très gonflé). */
    volume: Unit.default(0.4),
    /** Longueur pour `bob` / `long`. */
    length: Unit.default(0.5),
    /** Hauteur de la naissance des cheveux (0 = haute, 1 = basse). */
    hairline: Unit.default(0.5),
    /** Position de la raie, -1 (gauche de l'image) à 1 (droite). */
    part: z.number().min(-1).max(1).default(0),
    /** Longueur des pattes (favoris) devant l'oreille. */
    sideburns: Unit.default(0.3),
    /** Graine des brins, des pointes et des boucles (rendu déterministe). */
    seed: z.number().int().min(0).max(0xffffffff).default(1),
  })
  .strict();

export const MUSTACHES = ['none', 'thin', 'full', 'handlebar'] as const;
export const BEARDS = ['none', 'stubble', 'goatee', 'full'] as const;

export const FaceFacialHair = z
  .object({
    mustache: z.enum(MUSTACHES).default('none'),
    beard: z.enum(BEARDS).default('none'),
    /** Longueur de la barbe sous le menton. */
    length: Unit.default(0.4),
    /** Densité / opacité de la pilosité. */
    density: Unit.default(0.8),
    /** null : couleur des cheveux, un peu assombrie. */
    color: Hex.nullable().default(null),
    seed: z.number().int().min(0).max(0xffffffff).default(1),
  })
  .strict();

/** Asymétrie LÉGÈRE gauche/droite : les bornes interdisent toute dérive visible de l'ancrage. */
export const FaceAsymmetry = z
  .object({
    /** Œil droit de l'image plus petit (>0) ou œil gauche plus petit (<0) : facteur 1 - |valeur|. */
    eyeScale: z.number().min(-0.1).max(0.1).default(0),
    /** Œil gauche plus ouvert (>0) / œil droit plus ouvert (<0). */
    eyeOpenness: z.number().min(-0.2).max(0.2).default(0),
    /** Rotation commune des deux yeux AUTOUR de leur canthus interne (degrés, sens horaire). */
    eyeRollDeg: z.number().min(-4).max(4).default(0),
    /** Décalage vertical des canthi internes (fraction de H) : œil droit plus bas si > 0. */
    eyeDy: z.number().min(-0.012).max(0.012).default(0),
    /** Inclinaison de la bouche (et de la moustache qui la surmonte), en degrés. */
    mouthTiltDeg: z.number().min(-4).max(4).default(0),
  })
  .strict();

export type FaceNeck = z.infer<typeof FaceNeck>;
export type FaceHair = z.infer<typeof FaceHair>;
export type FaceFacialHair = z.infer<typeof FaceFacialHair>;
export type FaceAsymmetry = z.infer<typeof FaceAsymmetry>;
