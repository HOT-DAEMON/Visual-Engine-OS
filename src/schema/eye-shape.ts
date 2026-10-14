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
     * Styles ajoutés (session 5) : 'chibi' (grand œil arrondi façon Goku / Anya Forger : ouverture
     * haute, courbes supérieure et inférieure prononcées), 'angular' (contour supérieur rectiligne,
     * coin externe effilé, courbures tendues), 'compressed' (hauteur réduite par la fermeture des
     * paupières, largeur inchangée), 'rounded_rect' (rectangle à angles arrondis), et les trois
     * silhouettes de référence 'triangle' (dessus plat, sommet en bas), 'circle' (cercle) et
     * 'diamond' (parallélogramme dont les coins aigus sont les canthi, coins obtus arrondis) et son
     * double retravaillé 'diamond_v2' (plus long vers l'externe, dessous posé à l'horizontale).
     */
    style: z
      .enum(['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'])
      .default('almond'),
  })
  .strict();

