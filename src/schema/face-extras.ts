import { HairSim } from './hair-sim';
import { z } from 'zod';
import { Hex, Unit } from './primitives';
import { Appearance } from './appearance';
import { HairFlow, HairFringeEngine, HairLook, HairOcclusion, HairRootLift, HairSides, HairSilhouette, HairStrands, HairTextureMix, HairTiers, HairTips } from './hair-v2';
import { HAIR_FRINGES, HAIR_STYLES, HAIR_TEXTURE_CHOICES, HAIRLINES, HairBraids, HairTie } from './hair-system';

export { HAIR_FRINGES, HAIR_STYLES, HAIR_TEXTURES, HAIR_TEXTURE_CHOICES, HAIRLINES } from './hair-system';

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
    /** Angle cervico-mentonnier (degrés) : angle entre le dessous du menton et la face antérieure du cou (85 = net, 150 = effacé). */
    cervicomentalDeg: z.number().min(85).max(150).default(115),
    /** Épaisseur du tissu sous la mandibule (indépendante de `jaw.submental`, qui règle l'ombre portée du contact). */
    thickness: Unit.default(0.3),
    /** Relief des muscles du cou (sterno-cléido-mastoïdiens) et de leur transition vers le trapèze. */
    muscles: Unit.default(0.5),
    /** Tension visible du platysma quand la bouche s'ouvre ou que la tête s'incline. */
    platysma: Unit.default(0.4),
    /** Couplage menton → cou : 0 = INDÉPENDANTS (défaut : un menton projeté n'élargit pas le cou), 1 = le cou suit la projection du menton. */
    chinCoupling: Unit.default(0),
  })
  .strict();

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
    /** Graine des mèches, des pointes et des boucles (rendu déterministe). */
    seed: z.number().int().min(0).max(0xffffffff).default(1),
    /** TEXTURE des mèches, indépendante de la coiffure ('auto' = couplage historique style → texture). */
    texture: z.enum(HAIR_TEXTURE_CHOICES).default('auto'),
    /** Serrage de la texture : amplitude et fréquence des ondulations / boucles / vrilles. */
    curl: Unit.default(0.5),
    /** Forme de la ligne d'implantation (front). */
    hairlineShape: z.enum(HAIRLINES).default('round'),
    /** Recul des tempes (golfes) : 0 = naissance pleine, 1 = tempes très dégarnies. */
    recession: Unit.default(0),
    /** Irrégularité de l'implantation (bords inégaux, encoches, asymétrie gauche/droite). */
    irregularity: Unit.default(0.15),
    /** Éclaircissement (front et sommet) : moins de mèches, cuir chevelu visible. */
    thinning: Unit.default(0),
    /** Densité globale de mèches (0 = clairsemé, 1 = très fourni). */
    density: Unit.default(0.7),
    /** Variation de densité d'une zone à l'autre. */
    densityVariance: Unit.default(0.35),
    /** Variation de longueur d'une mèche à l'autre (pointes dentelées). */
    lengthVariance: Unit.default(0.35),
    /** Largeur de la raie : cuir chevelu visible entre les deux masses. */
    partWidth: Unit.default(0.25),
    /** Variation de teinte entre mèches (reflets, mèches claires et sombres). */
    highlight: Unit.default(0.35),
    /** Couleur des racines ; null : dérivée de `color`. */
    rootColor: Hex.nullable().default(null),
    /** Queue / chignon : voir `HairTie`. */
    tie: HairTie.default({}),
    /** Tresses pendantes (style `braids`). */
    braids: HairBraids.default({}),
    // --- Moteur v2 : tous les défauts sont neutres (voir `hair-v2.ts`) -------------------------------------------
    flow: HairFlow.default({}),
    silhouette: HairSilhouette.default({}),
    fringeEngine: HairFringeEngine.default({}),
    rootLift: HairRootLift.default({}),
    sides: HairSides.default({}),
    occlusion: HairOcclusion.default({}),
    tiers: HairTiers.default({}),
    tips: HairTips.default({}),
    strands: HairStrands.default({}),
    textureMix: HairTextureMix.default([]),
    look: HairLook.default({}),
    /** Apparence partagée (ombre/lumière/contour, dégradé, cel, effets) : voir `schema/appearance.ts`. */
    appearance: Appearance.default({}),
    /** Cheveux simulés (Verlet) : voir `hair-sim.ts`. Désactivé par défaut. */
    sim: HairSim.default({}),
  })
  .strict();

export const MUSTACHES = ['none', 'thin', 'full', 'handlebar', 'pencil'] as const;
export const BEARDS = ['none', 'stubble', 'short', 'full', 'long', 'goatee'] as const;
export const SIDEBURNS = ['none', 'short', 'long', 'mutton'] as const;

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
    /** Favoris : de l'oreille vers la joue, indépendants de la barbe et de la coiffure. */
    sideburns: z.enum(SIDEBURNS).default('none'),
    /** Transition peau/poils : 0 = bord net, 1 = lisière diffuse (poils épars au-delà du bord). */
    transition: Unit.default(0.5),
    /** Zones clairsemées (joues, menton) : 0 = couverture uniforme. */
    patchiness: Unit.default(0),
    /** Apparence partagée de la pilosité (mêmes contrats que les cheveux). */
    appearance: Appearance.default({}),
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
