import { z } from 'zod';
import { Unit } from './primitives';

/**
 * CONTRAT DU PROFIL DE STYLISATION (tâche T13 de `docs/TODO-FACE-SPEC.md`).
 * Le profil amplifie des traits de la GÉOMÉTRIE en préservant les relations essentielles (voir `face/stylize/`). Il n'est PAS un matériau et PAS un éclairage :
 * le mode de rendu (`FaceRenderMode`) est un autre champ, et changer de mode ne reconstruit jamais l'anatomie (vérifié par test).
 * Neutre par défaut : tous les gains à 0, `detail` à 1.
 */
export const FaceStylization = z
  .object({
    /** Exagération de la projection du menton (0 = aucune, 1 = maximale tout en gardant le menton devant la lèvre inférieure). */
    chinProjection: Unit.default(0),
    /** Exagération de la largeur mandibulaire (osseuse). */
    jawWidth: Unit.default(0),
    /** Angularité du contour : angle mandibulaire plus aigu, corps plus rectiligne, menton plus carré. */
    angularity: Unit.default(0),
    /** Contraste entre la largeur de la mâchoire et celle du cou (1 = cou très étroit sous une mâchoire massive). */
    jawNeckContrast: Unit.default(0),
    /** Taille relative de la bouche : −1 = minuscule, +1 = très large (bornée par le contour). */
    mouthSize: z.number().min(-1).max(1).default(0),
    /** Asymétrie des commissures (−1…1) : une commissure plus haute que l'autre. */
    cornerAsymmetry: z.number().min(-1).max(1).default(0),
    /** Simplification des transitions de surface : 0 = fondues, 1 = plans francs. */
    simplify: Unit.default(0),
    /** Intensité des contours dessinés (0 = aucun trait). */
    outline: Unit.default(0),
    /** Niveau de détail anatomique conservé (plis, relief du masséter, pores) malgré l'exagération : 1 = tout, 0 = volumes seuls. */
    detail: Unit.default(1),
    /** Posé à `true` par `applyStylization` : le profil n'est appliqué qu'UNE fois (idempotence). Ne pas écrire à la main. */
    baked: z.boolean().default(false),
  })
  .strict();

/** Mode de rendu : même géométrie, trois traitements. `ink` = encrage noir et blanc, `anime` = aplats à bords nets, `realistic` = modelé doux. */
export const RENDER_MODES = ['realistic', 'anime', 'ink'] as const;
export const FaceRenderMode = z.enum(RENDER_MODES);

export type FaceStylization = z.infer<typeof FaceStylization>;
export type FaceRenderMode = z.infer<typeof FaceRenderMode>;
