import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * CONTRAT DE L'ÉCLAIRAGE DES COMPOSANTS DU VISAGE : lumières de contour (rim), ombres de contact, zones lumineuses.
 * Comme le reste du visage, rien ici ne porte de coordonnée : un composant est désigné par son NOM, sa forme vient de la
 * géométrie, la lumière vient de `LightSpec`. Voir `docs/CONTACT-RIM.md` et `docs/SKIN-LIGHT.md`.
 */

/** Côté éclairé d'une lumière de contour. `auto` = côté de la lumière principale (le contour du côté opposé reste sombre). */
export const RIM_SIDES = ['auto', 'left', 'right', 'top', 'bottom', 'all'] as const;

/** Part de la lumière de contour d'un composant qui se propage à son parent, à ses enfants et à ses frères (un seul saut). */
export const RimInfluence = z
  .object({
    parent: Unit.default(0.2),
    children: Unit.default(0.3),
    siblings: Unit.default(0.15),
  })
  .strict();

/** Lumière de contour d'UN composant : couleur, intensité, largeur apparente, côté éclairé, influence parent/enfants/frères. */
export const RimSpec = z
  .object({
    /** `null` = teinte de contour de l'apparence de la peau (`skin.light.rim`). */
    color: Hex.nullable().default(null),
    intensity: Unit.default(0.35),
    /** Largeur apparente du liseré (0 = filet, 1 = bande large et douce). */
    width: Unit.default(0.35),
    side: z.enum(RIM_SIDES).default('auto'),
    influence: RimInfluence.default({}),
  })
  .strict();

/** Composants qui portent une lumière de contour. Les yeux et les cheveux ont déjà leurs moteurs (voir TODO-FACE.md). */
export const RIM_COMPONENTS = ['head', 'nose', 'tip', 'alae', 'ears', 'chin', 'mouth', 'neck'] as const;
export type RimComponent = (typeof RIM_COMPONENTS)[number];

export const FaceRims = z
  .object({
    // Défauts DISCRETS (un liseré, pas un contour) : la tête et les oreilles un peu plus, les petits volumes très peu.
    head: RimSpec.default({ intensity: 0.22, width: 0.3 }),
    nose: RimSpec.default({ intensity: 0.12, width: 0.25 }),
    tip: RimSpec.default({ intensity: 0.12, width: 0.25 }),
    alae: RimSpec.default({ intensity: 0.1, width: 0.2 }),
    ears: RimSpec.default({ intensity: 0.1, width: 0.2 }),
    chin: RimSpec.default({ intensity: 0.14, width: 0.3 }),
    mouth: RimSpec.default({ intensity: 0.08, width: 0.2 }),
    neck: RimSpec.default({ intensity: 0.08, width: 0.25 }),
  })
  .strict();

/** Ombre de contact d'UN composant. Trop faible → l'objet flotte ; trop forte → il semble collé (voir `verify`). */
export const ContactSpec = z
  .object({
    strength: Unit.default(0.5),
    /** Flou de l'ombre (0 = nette, 1 = très diffuse). */
    softness: Unit.default(0.5),
    /** 0 = occlusion ambiante seule (autour du contact) ; 1 = ombre portée directionnelle seule. */
    directionality: Unit.default(0.55),
  })
  .strict();

/** Composants qui projettent une ombre de contact (sur leur parent, ou sur leurs frères). */
export const CONTACT_COMPONENTS = ['nose', 'alae', 'orbits', 'ears', 'jaw', 'mouth', 'hair'] as const;
export type ContactComponent = (typeof CONTACT_COMPONENTS)[number];

export const FaceContacts = z
  .object({
    /** Multiplicateur global (0 = aucune ombre de contact). */
    master: Unit.default(0.75),
    nose: ContactSpec.default({}),
    alae: ContactSpec.default({}),
    orbits: ContactSpec.default({}),
    ears: ContactSpec.default({}),
    jaw: ContactSpec.default({}),
    mouth: ContactSpec.default({}),
    hair: ContactSpec.default({}),
  })
  .strict();

/** Une zone lumineuse diffuse : intensité et étalement. */
export const LightZone = z.object({ intensity: Unit.default(0.4), spread: Unit.default(0.5) }).strict();

/**
 * Zones lumineuses (éclairage doux mais directionnel) : front, nez, joues, épaules. Chaque zone est une tache de la couleur de la
 * lumière, DÉCALÉE vers la source (directionnalité) et bordée d'une chute douce (douceur).
 */
export const LightZones = z
  .object({
    forehead: LightZone.default({}),
    nose: LightZone.default({ intensity: 0.35, spread: 0.4 }),
    cheeks: LightZone.default({ intensity: 0.45, spread: 0.55 }),
    shoulders: LightZone.default({ intensity: 0.3, spread: 0.6 }),
    /** Décalage des zones vers la lumière (0 = centrées, 1 = fortement décalées). */
    directionality: Unit.default(0.6),
    /** Douceur du bord des zones. */
    softness: Unit.default(0.7),
  })
  .strict();

export const FaceLighting = z
  .object({
    rims: FaceRims.default({}),
    contacts: FaceContacts.default({}),
    zones: LightZones.default({}),
  })
  .strict();

export type RimSpec = z.infer<typeof RimSpec>;
export type ContactSpec = z.infer<typeof ContactSpec>;
export type FaceLighting = z.infer<typeof FaceLighting>;
export type FaceLightingInput = z.input<typeof FaceLighting>;
