import { z } from 'zod';
import { Hex, Unit } from './primitives';

export const Canthi = z
  .object({
    inner: z
      .object({
        /** Taille de la caroncule lacrymale (petit relief rose du canthus interne). */
        caruncle: Unit.default(0.5),
        color: Hex.default('#e79a96'),
        /** 0 = angle aigu, 1 = angle arrondi. */
        roundness: Unit.default(0.4),
      })
      .strict()
      .default({}),
    outer: z.object({ roundness: Unit.default(0.2) }).strict().default({}),
  })
  .strict();

/** Pli épicanthique : repli de peau qui recouvre le canthus interne. amount = 0 : absent. */
export const EpicanthicFold = z
  .object({
    amount: Unit.default(0),
    /** Étendue vers l'intérieur de la fente (0 = pli étroit, 1 = large). */
    reach: Unit.default(0.6),
  })
  .strict();
