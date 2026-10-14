import { z } from 'zod';
import { Hex, Unit } from './primitives';
import { ColorSource, MaterialRef } from './color-material';

export const Iris = z
  .object({
    radius: z.number().min(0.15).max(0.7).default(0.46),
    aspect: z.number().min(0.7).max(1.8).default(1.12),
    material: MaterialRef.default({
      base: {
        type: 'radial',
        stops: [
          { offset: 0, color: '#9be7ff' },
          { offset: 0.55, color: '#2f8fbf' },
          { offset: 1, color: '#0f2f5c' },
        ],
      },
      roughness: 0.3,
      clearcoat: 0.3,
    }),
    fibers: z.number().int().min(0).max(120).default(48),
    limbalRing: Unit.default(0.55),
    glow: z.object({ color: Hex, strength: Unit }).strict().nullable().default({ color: '#bff3ff', strength: 0.55 }),
  })
  .strict();

/**
 * Contour concentrique de la pupille. Plusieurs contours (jusqu'à 3) s'empilent vers l'extérieur,
 * chacun avec sa propre couleur/épaisseur/opacité — par ex. un fin liseré clair juste au bord de la
 * pupille, puis un anneau plus sombre un peu plus loin.
 */
export const PupilOutline = z
  .object({
    color: Hex,
    /** Épaisseur du trait, en fraction du rayon horizontal de la pupille. */
    width: z.number().min(0.01).max(0.4).default(0.08),
    opacity: Unit.default(1),
  })
  .strict();

export const Pupil = z
  .object({
    shape: z.enum(['round', 'slit_vertical', 'slit_horizontal']).default('round'),
    size: z.number().min(0.12).max(0.7).default(0.36),
    /** false : aucune pupille dessinée (l'iris reste plein) — état explicitement invisible. */
    visible: z.boolean().default(true),
    /**
     * Remplissage : uni, en dégradé linéaire (orientable via `angleDeg`, pour un effet de niveau —
     * ex. moitié claire/moitié sombre selon une direction choisie) ou radial (plusieurs tons
     * concentriques). Remplace l'ancien champ `color` (toujours un simple aplat) par la même
     * richesse que l'iris ou la sclère : plusieurs couleurs, orientables, avec plusieurs paliers.
     */
    fill: ColorSource.default({ type: 'solid', color: '#07090f' }),
    /** 0 à 3 contours concentriques, chacun de sa propre couleur — voir `PupilOutline`. */
    outlines: z.array(PupilOutline).max(3).default([]),
  })
  .strict();

export const Highlight = z.object({ size: z.number().min(0.03).max(0.5), opacity: Unit }).strict();

export const Highlights = z
  .object({
    primary: Highlight.default({ size: 0.24, opacity: 1 }),
    secondary: Highlight.nullable().default({ size: 0.11, opacity: 0.75 }),
  })
  .strict();
