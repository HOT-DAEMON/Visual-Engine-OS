import { z } from 'zod';

/**
 * Rotation 3D de la TÊTE, indépendante du regard (`gaze`, qui ne fait bouger que l'iris dans son
 * orbite) et de `transform.rotationDeg` (rotation 2D dans le plan de l'image). Les deux se
 * combinent : la tête peut être tournée en 3/4 ET le regard peut, en plus, dévier dans l'orbite
 * ainsi raccourcie — voir `lighting/head-turn.ts`.
 */
export const HeadTurn = z
  .object({
    /** >0 : la tête tourne vers la droite (on voit davantage sa joue droite). */
    yawDeg: z.number().min(-75).max(75).default(0),
    /** >0 : la tête s'incline vers le bas (menton rentré). */
    pitchDeg: z.number().min(-60).max(60).default(0),
    /**
     * `flat` (historique) : toute l'enveloppe est écrasée d'un seul facteur. `sphere` : chaque point de l'enveloppe palpébrale est
     * projeté sur la sphère de la tête (voir `geometry/eye/turn3d.ts`) — raccourcissement propre à chaque canthus et à chaque type
     * d'enveloppe, dépendant de la position de l'œil sur la tête.
     */
    model: z.enum(['flat', 'sphere']).default('flat'),
    /** Modèle `sphere` : position de l'œil autour de l'axe vertical de la tête (0 = face ; ≈ ±22° pour un visage humain). */
    azimuthDeg: z.number().min(-55).max(55).default(0),
    /** Modèle `sphere` : rayon de la tête en multiples de la largeur de l'œil (3 ≈ œil de 30 mm sur une tête de 90 mm de rayon). */
    radiusFactor: z.number().min(1.5).max(8).default(3),
    /** Modèle `sphere` : true = l'œil se déplace avec la parallaxe de la tête (hôte sans pose propre) ; false (défaut) = il tourne sur place, centré. */
    parallax: z.boolean().default(false),
  })
  .strict();
