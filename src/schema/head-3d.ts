import { z } from 'zod';
import { Hex, Slug } from './primitives';
import { Transform } from './light-transform';
import { SkullParams } from '../skull/types';
import { SkullVariation } from './head-profile';

/**
 * TÊTE 3D (tête + cou) d'un hôte `shape: 'face'` à un LACET et un TANGAGE quelconques (docs/PIPELINE-HEAD-3D.md) : la MÊME personne que le visage de face, vue sous n'importe quel angle.
 * C'est la rotation 3D du moteur `src/head-turntable` branchée au pipeline : crâne dérivé du visage de l'hôte (`deriveSkull`), mâchoire / menton / nez / bouche / oreille des moteurs de
 * composants, lisière des cheveux de la coiffure de l'hôte. Le contrat est celui de `head_profile` (aucune forme libre : `skull` = axes non dérivés, `variation` = variation bornée) ;
 * là où `head_profile` est fixé à 90°, `head_3d` prend `yaw` et `pitch`. Repère natif : hauteur 420, origine = le pivot du cou à la hauteur du sommet de la tête, 1 U = 240.
 */
export const Head3dSpec = z
  .object({
    kind: z.literal('head_3d'),
    id: Slug,
    /** Identifiant de l'hôte-visage dont ce rendu est la vue tournée. */
    host: Slug,
    /** Lacet en degrés : rotation de la tête autour de la verticale (0 = de face, 90 = de profil, 180 = de dos). Convention de la planche : lacet > 0 ⇒ le visage se tourne vers la GAUCHE de l'image. */
    yaw: z.number().min(-180).max(180).default(45),
    /** Tangage de la caméra en degrés : > 0 = contre-plongée (la caméra est sous la tête, comme la planche : 17,7°), < 0 = plongée, 0 = à hauteur des yeux. */
    pitch: z.number().min(-60).max(60).default(0),
    /** Roulis en degrés : inclinaison latérale de la tête autour de l'axe du nez, > 0 = vers la droite de l'image (sens horaire vu de face) ; le cou se plie avec elle (base immobile). ±40° (flexion latérale cervicale ≈ 45°). */
    roll: z.number().min(-40).max(40).default(0),
    /** Axes du crâne que le visage ne détermine pas ; les axes dérivés sont ÉCRASÉS par la dérivation (même contrat que `head_profile`). */
    skull: SkullParams.partial().default({}),
    variation: SkullVariation,
    /** Couleur des cheveux ; par défaut celle du visage de l'hôte. */
    hair: Hex.optional(),
    /** `host` = lisière réelle de la coiffure de l'hôte ; `short` = calotte courte dérivée du front. Un hôte chauve reste chauve. */
    hairline: z.enum(['host', 'short']).default('host'),
    /** Pixels de l'image par unité du repère natif (1 = 420 px de haut, 2 = 840, 3 = 1260) : le coût de rendu croît comme son carré. */
    resolution: z.number().int().min(1).max(3).default(2),
    /** Placement dans la scène (repère natif : H = 420). */
    transform: Transform.default({}),
  })
  .strict();
export type Head3dSpec = z.infer<typeof Head3dSpec>;
