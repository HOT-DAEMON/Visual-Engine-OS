import { z } from 'zod';
import { Unit } from './primitives';
import { MaterialRef } from './color-material';

export const Eyebrow = z
  .object({
    /** Espace entre le haut du pli (ou du bord libre) et le bas du sourcil, en fraction de la hauteur de l'œil. */
    gap: z.number().min(0).max(1).default(0.35),
    thickness: z.number().min(0.02).max(0.4).default(0.12),
    arch: Unit.default(0.5),
    /** Positif : la queue (côté externe) est plus haute que la tête. */
    tiltDeg: z.number().min(-30).max(30).default(8),
    /** Longueur, en fraction de la largeur de l'œil. */
    length: z.number().min(0.6).max(1.6).default(1.1),
    /** 0 = épaisseur constante, 1 = queue effilée en pointe. */
    taper: Unit.default(0.7),
    hairs: z.number().int().min(0).max(160).default(60),
    material: MaterialRef.default({ preset: 'matte', color: '#3a2a22' }),
    /**
     * Rapprochement (positif) ou écartement (négatif) de la TÊTE du sourcil (côté nez) par
     * rapport à sa position neutre — indépendant de `tiltDeg`, qui incline le sourcil en bloc.
     * C'est ce paramètre que la colère pousse en positif (sourcils froncés, rapprochés) et que la
     * peur pousse en négatif (sourcils écartés, relevés) : sur une paire d'yeux posée sur un hôte
     * (voir `place`), les deux têtes de sourcil se rapprochent ou s'écartent l'une de l'autre de
     * façon cohérente, puisque chaque œil pousse sa propre tête vers SON côté nez.
     */
    pinch: z.number().min(-1).max(1).default(0),
  })
  .strict();

