import { z } from 'zod';
import { Hex, Num, Unit } from './primitives';

/**
 * Influence de la lumière principale sur chaque CLASSE de matériau (1 = pleine, 0 = ignorée). Permet d'éclairer la peau
 * franchement tout en laissant les cheveux ou les yeux presque indifférents, sans toucher aux matériaux eux-mêmes.
 */
export const LightInfluence = z
  .object({
    skin: Unit.default(1),
    hair: Unit.default(1),
    eyes: Unit.default(1),
    lips: Unit.default(1),
    metal: Unit.default(1),
  })
  .strict();

/**
 * Lumière principale de la scène (le « key light »). Direction = azimut + élévation (inchangés). Ajouts du moteur d'éclairage
 * (`src/lighting/rig.ts`) : taille apparente de la source, température de couleur, dureté des ombres, distance (position),
 * influence par matériau. Tous les ajouts ont une valeur neutre : une scène existante se rend à l'identique.
 */
export const LightSpec = z
  .object({
    azimuthDeg: z.number().min(0).max(360).default(330),
    elevationDeg: z.number().min(10).max(90).default(55),
    color: Hex.default('#ffffff'),
    intensity: Unit.default(1),
    /** Taille apparente de la source : 0 = ponctuelle (ombres nettes, reflets petits), 1 = très grande (ombres très douces). */
    sourceSize: Unit.default(0.5),
    /** Température de couleur en kelvins (1800 bougie … 6500 jour … 10000 ciel bleu) ; `null` = `color` seule. */
    temperatureK: z.number().min(1500).max(12000).nullable().default(null),
    /** Dureté des ombres : 0 = très douces, 1 = franches. Se combine avec `sourceSize` (une grande source reste douce). */
    shadowHardness: Unit.default(0.5),
    /** Distance de la source en largeurs de tête ; `null` = à l'infini (lumière directionnelle sans dégradé d'intensité). */
    distance: z.number().min(0.5).max(20).nullable().default(null),
    influence: LightInfluence.default({}),
  })
  .strict();
export type LightSpec = z.infer<typeof LightSpec>;

export const Transform = z
  .object({
    x: Num.min(-1e6).max(1e6).default(0),
    y: Num.min(-1e6).max(1e6).default(0),
    rotationDeg: z.number().min(-180).max(180).default(0),
    scale: z.number().min(0.05).max(20).default(1),
  })
  .strict();
export type Transform = z.infer<typeof Transform>;
