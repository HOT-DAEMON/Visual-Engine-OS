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
    /** Nombre de pointes (`star` / `sparkle`), 3 à 12 (passe 11). Absent : forme historique (5 pour `star`, 4 pour `sparkle`). Réf. 10b : étoiles à six pointes. */
    points: z.number().int().min(3).max(12).optional(),
    /** null : couleur de la lumière de la scène. */
    color: Hex.nullable().default(null),
    /** Teinte des pointes et de l'aura (passe 13) : le cœur reste `color`, le dégradé radial va vers `tint` (réf. 10a : cœur blanc, pointes orangées ; 10b : bleu glacé). null : aucune teinte (rendu historique). */
    tint: Hex.nullable().default(null),
    /** Aiguilles de rayonnement (passe 13), `sparkle` / `star` : longueur des pointes AU-DELÀ du corps, en rayons du corps (réf. : fines lames effilées de 1 à 3 rayons). 0 : aucune (rendu historique). */
    rays: z.number().min(0).max(4).default(0),
    /** Irrégularité organique (passe 13) : écart des rayons des lobes du corps et des longueurs d'aiguilles, déterministe (empreinte de la position et de la taille). 0 : étoile régulière. */
    jitter: Unit.default(0),
    opacity: Unit.default(1),
    /** Douceur des bords (flou), en fraction de la taille. */
    softness: Unit.default(0),
    /** Intensité lumineuse : > 0 ajoute un halo diffus (bloom) autour du reflet. */
    intensity: Unit.default(0),
    confine: z.enum(HIGHLIGHT_CONFINE).default('globe'),
  })
  .strict();
export type HighlightItem = z.infer<typeof HighlightItem>;
