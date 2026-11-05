import { z } from 'zod';
import { Slug } from './primitives';
import { LightSpec } from './light-transform';

/**
 * ÉCLAIRAGE PAR RELIEF d'un hôte `shape: 'face'` (docs/PIPELINE-RELIEF.md) : le visage est un CHAMP DE RELIEF (profondeur + normales + régions : orbites, nez,
 * pommettes, lèvres, menton, cou), l'éclairage est calculé PAR PIXEL (ombres portées, occlusion ambiante, terminateur, lumière de contour) et posé par-dessus
 * le visage comme multiplicateur + lumière additive. Rendu = f(géométrie, matériaux, éclairage, caméra) : le relief ne dépend QUE de la géométrie du visage.
 * Sans `light`, la lumière de la scène est utilisée : le visage et le reste de la scène partagent la même source.
 */
export const HeadLitSpec = z
  .object({
    kind: z.literal('head_lit'),
    id: Slug,
    /** Identifiant de l'hôte-visage éclairé. */
    host: Slug,
    /** Surcharge partielle de la lumière de la scène (azimut, élévation, couleur, taille de source, dureté…). */
    light: LightSpec.partial().optional(),
    /** `soft` = terminateur progressif · `cel2` = 2 tons à bord net · `cel3` = + ton de cœur d'ombre. */
    style: z.enum(['soft', 'cel2', 'cel3']).default('soft'),
    shadowHue: z.enum(['warm', 'cool']).optional(),
    /** Multiplicateur du contraste d'éclairage (1 = défaut du style). */
    contrast: z.number().min(0.3).max(2).default(1),
    /** Seuil du terminateur en cosinus (0 = physique ; > 0 : la face plane reste dans l'ombre quand la lumière rase). */
    bias: z.number().min(-0.4).max(0.5).default(0),
    /** Intensité de la lumière de contour. */
    rim: z.number().min(0).max(1).default(0.35),
    /** Part de l'occlusion ambiante. */
    ao: z.number().min(0).max(1).default(0.5),
    /** Pixels par unité du champ de relief (coût ∝ ppu² : 1,6 ≈ 1,3 s à froid, 2,4 ≈ 4,3 s ; le cache de contenu rend 0,1 s au 2ᵉ appel). */
    ppu: z.number().min(1).max(4).default(1.6),
  })
  .strict();
export type HeadLitSpec = z.infer<typeof HeadLitSpec>;
