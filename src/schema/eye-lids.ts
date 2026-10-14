import { z } from 'zod';
import { Unit } from './primitives';
import { MaterialRef } from './color-material';

export const Lids = z
  .object({
    /** Couleur du bord libre (paupière). Le trait est plat : pas d'ombrage. */
    material: MaterialRef.default({ preset: 'matte', color: '#1a1420' }),
    thickness: z.number().min(0.01).max(0.2).default(0.06),
    /** Pointe au canthus externe (trait effilé). */
    wing: Unit.default(0.5),
    /** Pli palpébral supérieur. height = 0 : pas de pli (paupière sans pli). */
    crease: z
      .object({
        height: z.number().min(0).max(0.6).default(0.2),
        depth: Unit.default(0.5),
      })
      .strict()
      .default({}),
    /** Ligne humide du bord palpébral inférieur (0 = invisible). */
    waterline: Unit.default(0.4),
  })
  .strict();
