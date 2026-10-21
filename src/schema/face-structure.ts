import { z } from 'zod';
import { Unit } from './primitives';

/**
 * CONTRAT DE LA STRUCTURE PROFONDE ET DES TISSUS MOUS (tâches T3, T4, T6, T8 de `docs/TODO-FACE-SPEC.md`).
 *
 * Principe : la LARGEUR DE MÂCHOIRE n'est plus un paramètre unique. La silhouette extérieure est le RÉSULTAT de quatre contributions indépendantes :
 *     silhouette = os (`FaceParams.jawWidth`, inchangé : largeur bigoniaque osseuse) + muscle (`softTissue.masseter.volume`) + graisse (`softTissue.fat`) + bombement des joues (`cheek.volume`).
 * Correspondance avec les mots du cahier des charges (aucun doublon : chaque notion a UN seul paramètre) :
 *   largeur de la mandibule → `jawWidth` · hauteur de la branche montante → `jawY` · angle mandibulaire → `jaw.angle` · convergence vers le menton → `jaw.taper`
 *   courbure du corps → `mandible.bodyCurve` · profondeur (avant-arrière) → `mandible.depth` · bord inférieur → `mandible.lowerBorder` · région préauriculaire → `mandible.preauricular`.
 * Tous les défauts sont NEUTRES : la silhouette d'avant est inchangée tant que ces axes ne sont pas touchés.
 */

/** Mandibule (os) : ce qui n'est pas déjà dans `jawWidth`, `jawY`, `jaw.angle`, `jaw.taper`. Ne touche JAMAIS au crâne (au-dessus de la tempe). */
export const FaceMandible = z
  .object({
    /** Courbure du corps horizontal : 0.5 = neutre, < 0.5 = plus rectiligne (mâchoire carrée), > 0.5 = plus bombé (mâchoire ronde). */
    bodyCurve: Unit.default(0.5),
    /** Profondeur avant-arrière de la mandibule : en vue de face, elle se lit dans la largeur de la branche ombrée devant l'oreille. */
    depth: Unit.default(0.5),
    /** Netteté du bord inférieur : 0 = bord arrondi, noyé dans les tissus ; 1 = arête osseuse nette (liseré clair + ombre dessous). */
    lowerBorder: Unit.default(0.5),
    /** Largeur de la transition branche montante → région préauriculaire (devant l'oreille) : 0 = brusque, 1 = fondue. */
    preauricular: Unit.default(0.5),
  })
  .strict();

/** Masséter : volume (agrandit la silhouette au niveau de l'angle) et relief (définition visible de la sangle musculaire). */
export const SoftMasseter = z
  .object({
    volume: Unit.default(0),
    relief: Unit.default(0.4),
  })
  .strict();

/** Tissus mous qui recouvrent la mandibule : muscle, graisse, tissu péri-labial. */
export const FaceSoftTissue = z
  .object({
    masseter: SoftMasseter.default({}),
    /** Épaisseur de graisse (joues basses, bajoues) : agrandit la silhouette et ARRONDIT l'angle apparent. */
    fat: Unit.default(0),
    /** Plénitude du tissu qui entoure les lèvres (lèvre supérieure, menton antérieur) : plans et plis péri-labiaux. */
    perioral: Unit.default(0.5),
  })
  .strict();

/** Joues et pommettes. `volume` = chair qui recouvre l'os (0.5 neutre). */
export const FaceCheek = z
  .object({
    volume: Unit.default(0.5),
    /** Projection des pommettes (os zygomatique) : reflet et ombre inférieure. */
    boneProjection: Unit.default(0.5),
    /** Largeur de la région latérale (zone des joues vers les tempes). */
    lateralWidth: Unit.default(0.5),
    /** Creux sous la pommette (fosse infra-zygomatique). */
    hollow: Unit.default(0.35),
    /** Transition du creux vers le masséter : 0 = marche, 1 = continu. */
    masseterBlend: Unit.default(0.5),
    /** Élasticité : part du déplacement des tissus qui se traduit par un bombement (joue qui remonte) ou un étirement. */
    elasticity: Unit.default(0.5),
    /** Profondeur de base des plis péri-buccaux (commissure → menton), indépendante du sillon nasogénien (`nose.junction.nasolabial`). */
    perioralFold: Unit.default(0.3),
  })
  .strict();

export type FaceMandible = z.infer<typeof FaceMandible>;
export type FaceSoftTissue = z.infer<typeof FaceSoftTissue>;
export type FaceCheek = z.infer<typeof FaceCheek>;
