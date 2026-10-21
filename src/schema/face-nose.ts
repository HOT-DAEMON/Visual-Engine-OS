import { z } from 'zod';
import { Unit } from './primitives';
import { NoseBase, NoseColumella, NoseDomes, NoseGroove, NosePhiltrum, NoseSidewall } from './face-nose-regions';

/**
 * CONTRAT DU MOTEUR DE NEZ (`src/face/nose/`, `src/render/face/nose/`).
 *
 * Le nez est un ENFANT du visage, décomposé en sous-composants anatomiques qui sont eux-mêmes ses enfants :
 *   racine (nasion)  →  dorsum  →  pointe  →  ailes  →  narines   (+ raccords front / orbites / joues / région nasolabiale).
 * Tout est exprimé en fractions (de `W`, de `H` ou sans unité 0–1) : mettre le visage à l'échelle ne déforme rien.
 * Aucune coordonnée n'est portée par le nez : toutes les positions sont lues dans `face/landmarks.ts`
 * (ligne des yeux, canthi internes, base du nez, bouche), donc le nez ne peut pas « flotter » devant la tête.
 * Les anciens champs (`length`, `width`, `nostril`, `bridge`) restent valides et gardent leur sens.
 */

/** Profil du dorsum vu de côté ; `asymmetric` ajoute en plus une déviation latérale en S vue de face. */
export const DORSUM_SHAPES = ['straight', 'concave', 'convex', 'asymmetric'] as const;

/** Racine du nez : là où le nez naît entre les orbites, sous la glabelle (angle naso-frontal). */
export const NoseRoot = z
  .object({
    /** Hauteur du nasion : 0 = bas (au niveau des canthi internes), 1 = haut (vers les sourcils). */
    height: Unit.default(0.5),
    /** Profondeur de l'enfoncement naso-frontal : 0 = front et nez dans le même plan, 1 = encoche profonde. */
    depth: Unit.default(0.45),
    /** Largeur de la racine entre les orbites, relative à l'écart inter-canthal (0 = étroite, 1 = presque pleine). */
    width: Unit.default(0.5),
  })
  .strict();

/** Dorsum (arête) : forme du profil, largeur, déviation. */
export const NoseDorsum = z
  .object({
    shape: z.enum(DORSUM_SHAPES).default('straight'),
    /** Largeur de l'arête (0 = fine, 1 = large, plate). */
    width: Unit.default(0.5),
    /** Amplitude de la courbure du profil (concave : creux ; convexe : bosse). Sans effet pour `straight`. */
    curvature: Unit.default(0.5),
    /** Déviation latérale en S, de -1 (vers la gauche de l'image) à 1 ; n'agit que si `shape = 'asymmetric'`. */
    deviation: z.number().min(-1).max(1).default(0.5),
  })
  .strict();

/** Pointe du nez (lobule) : largeur, rondeur, projection, orientation, raccord aux ailes, reflet. */
export const NoseTip = z
  .object({
    width: Unit.default(0.5),
    /** 0 = pointue (angulaire), 1 = bulbeuse (ronde). */
    roundness: Unit.default(0.5),
    /** Avancée de la pointe devant le plan du visage (vue de face : ombre sous la pointe, taille du reflet). */
    projection: Unit.default(0.5),
    /** Orientation : -1 = pointe tournée vers le bas (narines cachées), +1 = relevée (narines visibles). */
    rotation: z.number().min(-1).max(1).default(0),
    /** Raccord pointe → ailes : 0 = rupture nette (supra-pointe marquée), 1 = fondu. */
    alarBlend: Unit.default(0.5),
    /** Intensité du reflet doux qui accentue le volume de la pointe. */
    highlight: Unit.default(0.5),
  })
  .strict();

/** Ailes du nez : épaisseur, volume, écartement, raccord avec la joue (sillon alaire). */
export const NoseAlae = z
  .object({
    /** Épaisseur du bord de l'aile (0 = fin, 1 = charnu). */
    thickness: Unit.default(0.5),
    /** Bombement de l'aile (ombrage de volume). */
    volume: Unit.default(0.5),
    /** Écartement latéral de l'aile par rapport à la pointe. */
    flare: Unit.default(0.5),
    /** Raccord avec la joue : 0 = sillon net, 1 = transition douce. */
    attachment: Unit.default(0.5),
  })
  .strict();

/** Narines : forme, orientation, asymétrie, columelle. Elles ne sont JAMAIS deux points noirs collés au nez. */
export const NoseNostrils = z
  .object({
    /** 0 = ronde, 1 = fente allongée en goutte. */
    shape: Unit.default(0.55),
    /** Inclinaison de l'axe d'une narine (degrés) : le haut converge vers la ligne médiane. */
    tiltDeg: z.number().min(0).max(50).default(24),
    /** Différence gauche/droite : -1…1 (la narine d'un côté est plus grande et plus ouverte). */
    asymmetry: z.number().min(-1).max(1).default(0),
    /** Largeur de la columelle (cloison entre les narines). */
    columella: Unit.default(0.5),
    /** Visibilité des narines ; `null` = dérivée de l'orientation de la pointe. */
    visibility: Unit.nullable().default(null),
    /** OUVERTURE visible de la narine (part de la goutte réellement sombre) : `null` = dérivée de la forme et de la visibilité (comportement d'avant). Indépendante de `shape` et de `nostril`. */
    opening: Unit.nullable().default(null),
    /** Épaisseur du BORD (rebord charnu) de la narine, en fraction de son petit axe. */
    rim: Unit.default(0.4),
  })
  .strict();

/** Raccords du nez avec le reste du visage : front, orbites, joues, région nasolabiale. */
export const NoseJunction = z
  .object({
    /** Fondu glabelle / front (0 = encoche marquée, 1 = continu). */
    glabella: Unit.default(0.5),
    /** Fondu des parois du nez avec les orbites (creux naso-jugal sous le canthus interne). */
    orbital: Unit.default(0.5),
    /** Fondu du sillon alaire avec la joue. */
    cheek: Unit.default(0.5),
    /** Profondeur du pli naso-génien (région nasolabiale). */
    nasolabial: Unit.default(0.4),
  })
  .strict();

export const FaceNose = z
  .object({
    /** Distance ligne des yeux → base du nez, fraction de H. */
    length: z.number().min(0.08).max(0.26).default(0.16),
    /** Largeur des ailes du nez, fraction de W. */
    width: z.number().min(0.08).max(0.3).default(0.16),
    /** Taille des narines (0 = invisibles). */
    nostril: Unit.default(0.6),
    /** Relief de l'arête (ombres latérales des parois). */
    bridge: Unit.default(0.4),
    root: NoseRoot.default({}),
    dorsum: NoseDorsum.default({}),
    tip: NoseTip.default({}),
    alae: NoseAlae.default({}),
    nostrils: NoseNostrils.default({}),
    junction: NoseJunction.default({}),
    /** Régions ajoutées (T1) : voir `face-nose-regions.ts`. Défauts neutres. */
    sidewall: NoseSidewall.default({}),
    domes: NoseDomes.default({}),
    groove: NoseGroove.default({}),
    base: NoseBase.default({}),
    columella: NoseColumella.default({}),
    philtrum: NosePhiltrum.default({}),
  })
  .strict();
export type FaceNose = z.infer<typeof FaceNose>;
export type FaceNoseInput = z.input<typeof FaceNose>;
