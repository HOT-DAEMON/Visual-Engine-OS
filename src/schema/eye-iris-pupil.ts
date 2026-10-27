import { z } from 'zod';
import { Hex, Unit } from './primitives';
import { ColorSource, MaterialRef } from './color-material';
import { HighlightItem } from './eye-highlights';
import { IrisLayer } from './eye-iris-layers';
import { PUPIL_SHAPES, PupilCenter, PupilDeform, PupilEdge, PupilLobes, PupilMultiple, PupilResponse } from './eye-pupil-profile';

/**
 * Iris détaillé (opt-in, `null` par défaut : rendu historique inchangé). Chaque couche reprend un
 * élément réel ou stylisé de l'iris, du centre vers le bord : zone pupillaire, collerette (anneau
 * irrégulier), fibres du stroma à deux échelles, cryptes, « flammes » d'accent, assombrissement
 * limbique, ombre portée de la paupière haute, lueur basse, halo de pupille et scintillements.
 * Les couleurs dérivent du matériau de l'iris ; seuls l'accent, la zone pupillaire et la lueur
 * peuvent être imposés. Tout est déterministe (seed de l'œil).
 */
export const IrisDetail = z
  .object({
    /** Richesse globale (nombre de fibres/hachures). */
    density: Unit.default(0.7),
    /** Contraste des fibres (opacité claire/sombre). */
    contrast: Unit.default(0.6),
    /** Collerette : anneau en dents de scie autour de la pupille. null : aucune. */
    collarette: z
      .object({
        /** Rayon, en fraction du rayon de l'iris (toujours au-delà de la pupille). */
        radius: z.number().min(0.3).max(0.85).default(0.55),
        irregularity: Unit.default(0.55),
        opacity: Unit.default(0.65),
      })
      .strict()
      .nullable()
      .default({}),
    /** Zone pupillaire (entre pupille et collerette). null : aucune. */
    innerZone: z
      .object({
        /** null : version éclaircie du centre de l'iris. */
        color: Hex.nullable().default(null),
        strength: Unit.default(0.5),
      })
      .strict()
      .nullable()
      .default({}),
    crypts: z.number().int().min(0).max(24).default(10),
    /** Flammes autour de la pupille (motif décoratif, hétérochromie centrale). null : aucune. */
    accent: z
      .object({
        color: Hex,
        /** Étendue vers le bord, en fraction de l'espace pupille → bord. */
        reach: z.number().min(0.1).max(1).default(0.5),
        spikes: z.number().int().min(6).max(48).default(22),
        opacity: Unit.default(0.85),
      })
      .strict()
      .nullable()
      .default(null),
    limbal: z
      .object({
        /** Largeur de la zone assombrie, en fraction du rayon. */
        width: z.number().min(0.05).max(0.5).default(0.24),
        strength: Unit.default(0.7),
      })
      .strict()
      .default({}),
    /** Ombre de la paupière haute sur l'iris (haut de l'iris plus sombre). */
    topShade: Unit.default(0.4),
    /** Lueur basse de l'iris (lumière qui traverse la cornée). null : aucune. */
    bottomGlow: z
      .object({ color: Hex.nullable().default(null), strength: Unit.default(0.5) })
      .strict()
      .nullable()
      .default({}),
    /** Halo clair autour de la pupille. */
    pupilHalo: Unit.default(0.35),
    /** Petits points de lumière dispersés dans la moitié basse. */
    sparkles: z.number().int().min(0).max(16).default(0),
  })
  .strict();

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
    /** Iris détaillé — voir `IrisDetail`. null : aucun (comportement historique). */
    detail: IrisDetail.nullable().default(null),
    /** Couches de couleur à masques/gradients (EYE-04) — voir `eye-iris-layers.ts`. Vide : aucune (comportement historique). */
    layers: z.array(IrisLayer).max(8).default([]),
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
    shape: z.enum(PUPIL_SHAPES).default('round'),
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
    /** EYE-05D : rotation de la forme autour de son centre (degrés). */
    orientationDeg: z.number().min(-180).max(180).default(0),
    center: PupilCenter.default({}),
    edge: PupilEdge.default({}),
    response: PupilResponse.default({}),
    /** Sommets des profils `star` / `polygon` / `cross`. */
    lobes: PupilLobes.default({}),
    multiple: PupilMultiple.default({}),
    deform: PupilDeform.default({}),
  })
  .strict();

export const Highlight = z.object({ size: z.number().min(0.03).max(0.5), opacity: Unit }).strict();

export const Highlights = z
  .object({
    primary: Highlight.default({ size: 0.24, opacity: 1 }),
    secondary: Highlight.nullable().default({ size: 0.11, opacity: 0.75 }),
    /** Reflets détaillés (jusqu'à 6). Liste non vide : REMPLACE `primary`/`secondary` (voir `eye-highlights.ts`). */
    list: z.array(HighlightItem).max(6).default([]),
  })
  .strict();
