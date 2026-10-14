import { z } from 'zod';

export const Shape = z
  .object({
    width: z.number().min(10).max(4000).default(200),
    height: z.number().min(10).max(4000).default(120),
    tiltDeg: z.number().min(-30).max(30).default(6),
    upperFraction: z.number().min(0.4).max(0.8).default(0.62),
    openness: z.number().min(0.05).max(1.2).default(1),
    /** 'auto' : le coin externe est du côté opposé au centre de l'hôte (sur un hôte) ; 'right' hors hôte. */
    outerSide: z.enum(['left', 'right', 'auto']).default('right'),
    /**
     * Famille de silhouette (varie surtout le canthus EXTERNE, le canthus interne reste anatomiquement
     * stable d'un style à l'autre) : 'almond' (classique), 'round' (kawaii, plus circulaire),
     * 'sharp' (tsurime, coin externe relevé et pointu), 'drooping' (tareme, coin externe tombant).
     */
    style: z.enum(['almond', 'round', 'sharp', 'drooping']).default('almond'),
  })
  .strict();

