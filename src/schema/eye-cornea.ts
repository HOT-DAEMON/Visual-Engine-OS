import { z } from 'zod';
import { Unit } from './primitives';

/**
 * EYE-03C→03H / OPT-02 — CORNÉE. Opt-in : `null` = rendu historique (l'iris est dessiné « à nu »). Tous les champs sont CONSOMMÉS (tests/eye-cornea.test.ts) :
 *  - `curvature`, `depth`, `index`, `refraction` : loi radiale de réfraction par lancer de rayon (geometry/eye/cornea.ts) appliquée à la pupille, aux couches de couleur et aux
 *    atomes radiaux de l'iris par `applyCornea` (render/eye/cornea.ts) — les reflets, eux, vivent sur la surface de la cornée et ne sont PAS réfractés (physiquement exact) ;
 *  - `haze` : transition cornéosclérale (EYE-03F) — la sclère voisine du limbe prend la teinte du bord de l'iris sur une largeur qui dépend de la courbure.
 * Le limbe (03C : largeur, contraste, netteté) reste porté par `iris.limbalRing` et `iris.detail.limbal` (pas de doublon) ; l'état de surface et les reflets (03E) par `highlights` et
 * `microdetail.tearFilm` ; l'occlusion par les paupières (03H) par `microdetail.occlusion`.
 */
export const Cornea = z
  .object({
    /** Courbure : rayon de l'iris / rayon de courbure de la cornée (humain ≈ 5,9 / 7,8 = 0,76). */
    curvature: z.number().min(0.3).max(1.1).default(0.76),
    /** Profondeur apex → plan de l'iris, en rayons d'iris (humain ≈ 3,6 / 5,9 = 0,61). */
    depth: z.number().min(0.2).max(1.2).default(0.61),
    /** Indice de réfraction (cornée + humeur aqueuse ≈ 1,376). */
    index: z.number().min(1.05).max(2).default(1.376),
    /** 0 = aucune réfraction, 1 = physique, jusqu'à 3 = exagération artistique assumée. */
    refraction: z.number().min(0).max(3).default(1),
    /** Transition cornéosclérale (0 = limbe net, 1 = halo marqué). */
    haze: Unit.default(0.3),
  })
  .strict();
export type Cornea = z.infer<typeof Cornea>;
