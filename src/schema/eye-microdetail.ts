import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * EYE-07 / EYE-01 — Microdétails de la sclère et des tissus (TODO-EYES-SYSTEMS-2 §2.7). Opt-in : `null` = rendu historique.
 * Chaque microdétail a une ÉCHELLE DE VISIBILITÉ : `lod.eyePixels` (largeur approximative de l'œil dans l'image finale) réduit puis
 * désactive les microstructures sans changer l'identité de l'œil (mêmes graines, mêmes positions pour les détails conservés).
 */
export const Vessels = z
  .object({
    /** EYE-07A. Densité (0 = aucun). */
    density: Unit.default(0.4),
    thickness: Unit.default(0.4),
    tint: Hex.default('#c4574e'),
    visibility: Unit.default(0.5),
    /** Probabilité / nombre de ramifications par tronc. */
    branching: Unit.default(0.6),
  })
  .strict();

export const TearFilm = z
  .object({
    /** EYE-07C / EYE-01 : humidité apparente (ménisque lacrymal + film spéculaire sur le globe). */
    wetness: Unit.default(0.5),
    /** Largeur du ménisque le long du bord inférieur. */
    meniscus: Unit.default(0.5),
  })
  .strict();

export const Microdetail = z
  .object({
    vessels: Vessels.nullable().default({}),
    /** EYE-07B : zones plus chaudes (rosées, près des canthi) et plus froides (ombre sous la paupière haute). */
    chroma: z.object({ warm: Unit.default(0.35), cool: Unit.default(0.25) }).strict().nullable().default({}),
    tearFilm: TearFilm.nullable().default({}),
    /** EYE-07H : occlusion locale (ombre de contact des paupières sur le globe). */
    occlusion: Unit.default(0.4),
    /** EYE-07F : petites marques facultatives (nombre). */
    imperfections: z.number().int().min(0).max(8).default(0),
    /** EYE-07 LOD : largeur approximative de l'œil en pixels dans l'image finale ; null = détail complet. */
    lod: z.object({ eyePixels: z.number().min(8).max(8000).nullable().default(null) }).strict().default({}),
  })
  .strict();
export type Microdetail = z.infer<typeof Microdetail>;
