import { z } from 'zod';
import { Slug } from './primitives';
import { MaterialRef } from './color-material';
import { Transform } from './light-transform';

export const Place = z
  .object({
    host: Slug,
    anchors: z.array(Slug).max(64).default([]),
    patterns: z.array(Slug).max(16).default([]),
    /** 'same' : mêmes graines partout (yeux identiques) ; 'vary' : graine décalée par exemplaire. */
    variation: z.enum(['same', 'vary']).default('same'),
  })
  .strict();

export const AnchorCoord = z.number().min(-1.5).max(1.5);
export const Follow = z.enum(['none', 'surface']);

export const Anchor = z
  .object({
    id: Slug,
    x: AnchorCoord.default(0),
    y: AnchorCoord.default(0),
    rotationDeg: z.number().min(-180).max(180).default(0),
    scale: z.number().min(0.05).max(20).default(1),
    follow: Follow.default('none'),
  })
  .strict();

export const Vec2 = z.object({ x: AnchorCoord, y: AnchorCoord }).strict();

export const Pattern = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('ring'),
      id: Slug,
      count: z.number().int().min(1).max(32),
      radius: z.number().min(0).max(1.5).default(0.8),
      startDeg: z.number().min(-360).max(360).default(0),
      scale: z.number().min(0.05).max(20).default(1),
      follow: Follow.default('surface'),
    })
    .strict(),
  z
    .object({
      type: z.literal('line'),
      id: Slug,
      count: z.number().int().min(1).max(32),
      from: Vec2,
      to: Vec2,
      scale: z.number().min(0.05).max(20).default(1),
      follow: Follow.default('none'),
    })
    .strict(),
]);

/**
 * Hôte : surface (ellipse ou rectangle arrondi) qui porte des ancres nommées.
 * Coordonnées d'ancre normalisées : ±1 = bord de l'hôte (demi-largeur / demi-hauteur).
 */
export const HostSpec = z
  .object({
    kind: z.literal('host'),
    id: Slug,
    transform: Transform.default({}),
    shape: z.enum(['ellipse', 'rounded_rect']).default('ellipse'),
    width: z.number().min(10).max(4000).default(300),
    height: z.number().min(10).max(4000).default(300),
    cornerRadius: z.number().min(0).max(2000).default(16),
    material: MaterialRef,
    anchors: z.array(Anchor).max(64).default([]),
    patterns: z.array(Pattern).max(16).default([]),
    /** Dessine un repère à chaque ancre (aide à l'authoring). */
    showAnchors: z.boolean().default(false),
  })
  .strict();
export type HostSpec = z.infer<typeof HostSpec>;
