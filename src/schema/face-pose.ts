import { z } from 'zod';

/**
 * POSE de la tête du visage (`docs/ROTATION-STEP-02-SVG-SILHOUETTE.md`) : rotation anatomique autour de l'axe vertical du cou, DISTINCTE de `HostSpec.transform.rotationDeg` (rotation 2D de l'objet dans la
 * scène) et du regard. Même convention que `HeadTurn` (yeux) et que `face/pose/tree.ts` : `yawDeg` > 0 = le visage se tourne vers la droite de l'image ; 0 = de face (rendu historique, identique à l'octet près).
 * Seul le lacet existe ici ; le tangage viendra avec l'étape 5 (rotations composées), il n'est donc pas accepté tant qu'il serait ignoré.
 */
export const FaceHeadPose = z
  .object({
    yawDeg: z.number().min(-75).max(75).default(0),
  })
  .strict();
export type FaceHeadPose = z.infer<typeof FaceHeadPose>;
