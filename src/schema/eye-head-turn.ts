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
  })
  .strict();
