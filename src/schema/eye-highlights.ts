import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * OPT-01 / OPT-04 — Reflets : un objet par reflet, avec ses propres paramètres (TODO-EYES-SYSTEMS-2 §3.1).
 * Distinction explicite entre CAUSE PHYSIQUE et EFFET ARTISTIQUE :
 *  - `kind: 'reflection'` : reflet de la source, la position suit la lumière (ancrage `light`) — sa forme est celle de la source ;
 *  - `kind: 'graphic'`    : highlight dessiné (anime, étoile, éclat magique), indépendant de l'éclairage physique.
 */
export const HIGHLIGHT_SHAPES = ['circle', 'ellipse', 'star', 'diamond', 'sparkle', 'cross'] as const;

/** Où le reflet est attaché : à la source lumineuse (physique), à l'iris (composition), au globe (caméra). */
export const HIGHLIGHT_ANCHORS = ['light', 'iris', 'globe'] as const;

/** Zone dans laquelle le reflet est confiné (règle d'occlusion) : jamais hors de l'ouverture, optionnellement de l'iris. */
export const HIGHLIGHT_CONFINE = ['globe', 'iris'] as const;

export const HighlightItem = z
  .object({
    kind: z.enum(['reflection', 'graphic']).default('graphic'),
    role: z.enum(['primary', 'secondary']).default('primary'),
    shape: z.enum(HIGHLIGHT_SHAPES).default('circle'),
    anchor: z.enum(HIGHLIGHT_ANCHORS).default('light'),
    /** Position relative : pour `light`, multiplicateur de la direction du vecteur médian (1 = bord de l'iris × 0,85) ;
     *  pour `iris` / `globe`, décalage x,y en fraction du rayon horizontal de l'iris. */
    along: z.number().min(-1.5).max(1.5).default(0.85),
    x: z.number().min(-1.5).max(1.5).default(0),
    y: z.number().min(-1.5).max(1.5).default(0),
    /** Taille : fraction du rayon horizontal de l'iris (largeur) ; `aspect` = hauteur / largeur. */
    size: z.number().min(0.03).max(0.9).default(0.2),
    aspect: z.number().min(0.2).max(4).default(1),
    rotationDeg: z.number().min(-180).max(180).default(0),
    /** Pointes (star/sparkle) ou rapport intérieur (0,12–0,9). */
    inner: z.number().min(0.12).max(0.9).default(0.4),
    /** null : couleur de la lumière de la scène. */
    color: Hex.nullable().default(null),
    opacity: Unit.default(1),
    /** Douceur des bords (flou), en fraction de la taille. */
    softness: Unit.default(0),
    /** Intensité lumineuse : > 0 ajoute un halo diffus (bloom) autour du reflet. */
    intensity: Unit.default(0),
    confine: z.enum(HIGHLIGHT_CONFINE).default('globe'),
  })
  .strict();
export type HighlightItem = z.infer<typeof HighlightItem>;
