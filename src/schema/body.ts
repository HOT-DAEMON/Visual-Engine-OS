import { z } from 'zod';
import { Slug } from './primitives';
import { BodyParams } from '../body/types';
import { LegParams } from '../body/lower/types';

/**
 * Corps (tronc + membres supérieurs) SUSPENDU au cou d'un hôte `shape: 'face'`.
 * Contrat : le corps ne porte AUCUNE coordonnée absolue. Il lit seulement le cou du visage (`anchorFromFace`, source unique :
 * `faceLandmarks`), prend la transformation MONDE de son hôte et la teinte de peau du matériau de l'hôte (une seule peau pour la
 * tête et le corps). `body` = `BodyParams` (âge, sexe, adiposité, musculature, charpente, membres, poses des bras).
 */
export const BodySpec = z
  .object({
    kind: z.literal('body'),
    id: Slug,
    /** Identifiant de l'hôte-visage dont le corps est l'enfant (par le cou). */
    host: Slug,
    body: BodyParams.default({}),
    /**
     * Bas du corps (bassin, cuisses, genoux, jambes, pieds) : `false` = BUSTE (le tronc s'arrête à la ligne des hanches : cadrage portrait, coût minimal) ;
     * un objet `LegParams` (même `{}`) = FIGURE complète. Le bas lit le même `BodyFrame` que le haut : aucun axe dupliqué (docs/PIPELINE-LOWER.md).
     */
    legs: z.union([z.literal(false), LegParams]).default(false),
    /** Hiérarchie de présentation : 0 silhouette · 1 + masses · 2 + muscles · 3 + repères et micro-détails. */
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(3),
    /** `skin` = rendu final ; `atoms` = chaque atome coloré par composant (preuve du morcellement). */
    mode: z.enum(['skin', 'atoms']).default('skin'),
  })
  .strict();
export type BodySpec = z.infer<typeof BodySpec>;
