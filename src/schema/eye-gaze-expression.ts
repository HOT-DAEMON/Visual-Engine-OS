import { z } from 'zod';
import { Unit } from './primitives';

export const Gaze = z
  .object({
    x: z.number().min(-1).max(1).default(0),
    y: z.number().min(-1).max(1).default(0),
  })
  .strict();

/**
 * Regard biologique : orientation 3D du globe oculaire dans l'orbite, autour de son propre centre
 * (indépendante de `transform.rotationDeg`, qui oriente l'œil entier — paupières comprises — dans
 * la scène). yawDeg : gauche/droite ; pitchDeg : haut/bas. `travel` règle l'amplitude du
 * déplacement de l'iris pour un même angle (globe plus ou moins profond dans l'orbite).
 */
export const EyeGaze = z
  .object({
    yawDeg: z.number().min(-45).max(45).default(0),
    pitchDeg: z.number().min(-35).max(35).default(0),
    travel: z.number().min(0.3).max(1.5).default(1),
  })
  .strict();

/**
 * Expression faciale : recalcule à la volée (fonction pure, sans hasard) l'ouverture, le pli,
 * le sourcil et l'inclinaison du regard à partir de la valeur neutre. N'affecte ni les couleurs
 * ni la géométrie de l'iris/sclère — c'est une limite assumée (voir `expressions/deltas.ts`), pas
 * un oubli : un œil « en sang » par exemple resterait à faire via la couleur de la sclère, pas via
 * ce système de pose. null ou intensity=0 : neutre, aucun effet.
 *
 * 'fierce' couvre l'idée de regard féroce/perçant ; faute de pouvoir confirmer que « sanglant »
 * désignait autre chose, c'est l'interprétation la plus proche retenue (voir le commentaire sur
 * FIERCE dans deltas.ts pour le détail et la réserve explicite).
 */
export const Expression = z
  .object({
    kind: z
      .enum([
        'neutral',
        'angry',
        'sad',
        'fearful',
        'anguished',
        'melancholic',
        'drowsy',
        'surprised',
        'sulky',
        'furious',
        'joyful',
        'smiling',
        'fierce',
        'stressed',
      ])
      .default('neutral'),
    intensity: Unit.default(1),
  })
  .strict();
