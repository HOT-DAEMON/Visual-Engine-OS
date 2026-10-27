import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * EYE-04H/I/M/O — Couches de COULEUR de l'iris (TODO-EYES-SYSTEMS §2.4 : « la couleur n'est pas un seul paramètre »).
 * Chaque couche a SA géométrie de masque, son gradient, son opacité, son orientation, son comportement optique (fusion, halo),
 * et une irrégularité à graine (EYE-04L) : deux yeux partagent palette et morphologie sans motifs identiques.
 * Angles : 0° = haut, sens horaire. Rayons : fraction du rayon horizontal de l'iris (0 = centre, 1 = limbe).
 *
 * Exemples du cahier des charges : bleu + anneau doré autour de la pupille = [full bleu, ring doré inner 0.18 outer 0.45] ;
 * gris avec zone turquoise dans la moitié supérieure = [full gris, half turquoise angleDeg 0] ;
 * bleu en haut / doré en bas = [full, gradient angular color bleu → color2 doré, angleDeg 0].
 */
export const IRIS_MASKS = ['full', 'ring', 'sector', 'half', 'spot'] as const;
export const IRIS_GRADIENTS = ['none', 'radial', 'angular'] as const;
/** Fusion émulée (le SVG du moteur n'admet pas `mix-blend-mode`) : la couleur de la couche est pré-mélangée à celle de l'iris. */
export const IRIS_BLENDS = ['normal', 'multiply', 'screen'] as const;

export const IrisLayer = z
  .object({
    color: Hex,
    /** Seconde couleur du gradient (null : couleur unie). */
    color2: Hex.nullable().default(null),
    mask: z.enum(IRIS_MASKS).default('full'),
    /** Bornes radiales de la zone (ring/sector/half/full) ; pour `spot`, la position radiale du centre est leur moyenne. */
    inner: Unit.default(0),
    outer: Unit.default(1),
    angleDeg: z.number().min(-360).max(360).default(0),
    /** Ouverture angulaire du secteur, en degrés (`half` = 180 fixe). */
    span: z.number().min(10).max(360).default(120),
    /** Rayon du spot (fraction du rayon de l'iris). */
    spotRadius: z.number().min(0.04).max(0.6).default(0.18),
    /** none : couleur unie ; radial : color (intérieur) → color2 (limbe) ; angular : color → color2 autour de l'iris / dans le secteur. */
    gradient: z.enum(IRIS_GRADIENTS).default('none'),
    opacity: Unit.default(0.8),
    /** Douceur des bords de la zone (fondu radial et angulaire). */
    feather: Unit.default(0.3),
    /** Irrégularité à graine des bornes (taches, bords organiques). */
    irregularity: Unit.default(0),
    blend: z.enum(IRIS_BLENDS).default('normal'),
    /** Halo lumineux de la couche (iris fantastique, anneaux lumineux). */
    glow: Unit.default(0),
  })
  .strict();
export type IrisLayer = z.infer<typeof IrisLayer>;
