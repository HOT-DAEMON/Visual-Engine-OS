import { z } from 'zod';
import { Hex, Unit } from './primitives';

/**
 * SCHÉMA DU MOTEUR D'OREILLE (Ear Morphology Engine). Les six dimensions du cahier des charges sont SIX groupes distincts du contrat :
 *   anatomie + géométrie → `morph` (déviations signées autour de la forme de la famille) et `anchors`/`attach` (attache au crâne) ;
 *   matériaux            → `material` ;      éclairage/rendu → lu dans `lighting`/`skin` du visage (jamais ici) ;
 *   grammaire artistique → `style` ;          identité/espèce → `family` + `blend` + `extensions`.
 * Changer le style ne touche pas `morph` ; changer la famille ne touche pas `material`. Les anciens champs (`size`, `aspect`, `tiltDeg`) ne servent
 * qu'au moteur `classic` (ellipse) et restent valides.
 */
export const EarFamily = z.enum(['human', 'feline', 'canid', 'equid', 'elven', 'draconic', 'alien']);
export type EarFamily = z.infer<typeof EarFamily>;
export const EarMaterialKind = z.enum(['skin', 'cartilage', 'scaly', 'membrane', 'ceramic', 'crystal', 'hybrid']);
export type EarMaterialKind = z.infer<typeof EarMaterialKind>;
export const EarExtensionKind = z.enum(['terminal_tip', 'secondary_ridge', 'branching_ridge', 'membrane_panel', 'ornamental_growth', 'bioluminescent_channel']);
export type EarExtensionKind = z.infer<typeof EarExtensionKind>;
export const EarPiercingKind = z.enum(['ear_lobe_piercing', 'helix_piercing', 'tragus_piercing', 'conch_piercing', 'industrial_piercing']);

/** Déviation signée : 0 = forme de la famille, −1 / +1 = extrêmes. */
const Sg = z.number().min(-1).max(1).default(0);

/** Déviations morphologiques par structure (EAR-01 … EAR-07 et contour C01–C07). Toutes à 0 par défaut : la forme de la famille, intacte. */
export const EarMorph = z
  .object({
    /** C01 pôle supérieur : hauteur, rondeur (−1 = pointu/triangulaire), inclinaison du sommet vers l'arrière, pointe terminale. */
    pole: z.object({ height: Sg, round: Sg, lean: Sg, tip: Sg }).strict().default({}),
    /** C02 bord postérieur : convexité. */
    posterior: z.object({ convexity: Sg }).strict().default({}),
    /** Largeur de l'oreille (rapport largeur/hauteur de la famille, ±35 %). */
    width: Sg,
    /** EAR-07 lobule : longueur (−1 = absent), largeur, attache (+1 = collé à la joue, −1 = libre), pendance. */
    lobule: z.object({ length: Sg, width: Sg, attach: Sg, sag: Sg }).strict().default({}),
    /** EAR-06 tragus, antitragus, incisure intertragique. */
    tragus: z.object({ size: Sg, projection: Sg }).strict().default({}),
    antitragus: z.object({ size: Sg, orientation: Sg }).strict().default({}),
    notch: z.object({ depth: Sg }).strict().default({}),
    /** EAR-01 hélix : épaisseur du rebord et enroulement (relief). */
    helix: z.object({ thickness: Sg, roll: Sg }).strict().default({}),
    /** EAR-02 anthélix : relief, écart des branches, longueur des branches supérieure et inférieure. */
    antihelix: z.object({ relief: Sg, branchAngle: Sg, upperLength: Sg, lowerLength: Sg }).strict().default({}),
    /** EAR-05 conque : profondeur, part de la cymba. EAR-03 scapha : largeur, profondeur. EAR-02 crus de l'hélix : épaisseur. */
    concha: z.object({ depth: Sg, cymba: Sg }).strict().default({}),
    scapha: z.object({ width: Sg, depth: Sg }).strict().default({}),
    crus: z.object({ thickness: Sg }).strict().default({}),
  })
  .strict();
export type EarMorph = z.infer<typeof EarMorph>;

export const EarExtension = z
  .object({
    kind: EarExtensionKind,
    /** Position le long de la structure porteuse (0–1), longueur et intensité relatives. */
    at: Unit.default(0.5),
    length: Unit.default(0.5),
    intensity: Unit.default(0.6),
  })
  .strict();

export const EarPiercing = z
  .object({
    kind: EarPiercingKind,
    jewel: z.enum(['stud', 'ring', 'drop', 'chain']).default('stud'),
    /** Taille du bijou (fraction de la hauteur de l'oreille) et pendant (0 = collé, 1 = pendant au maximum). */
    size: z.number().min(0.03).max(0.4).default(0.08),
    hang: Unit.default(0.5),
    color: Hex.default('#d4af37'),
  })
  .strict();

export const FaceEars = z
  .object({
    visible: z.boolean().default(true),
    /** Largeur d'une oreille, fraction de W (moteur `classic`). */
    size: z.number().min(0.04).max(0.16).default(0.09),
    /** Rapport hauteur/largeur (moteur `classic`). */
    aspect: z.number().min(1).max(2.6).default(1.6),
    /** Inclinaison (degrés) : le haut penche vers l'extérieur si positif (moteur `classic`). */
    tiltDeg: z.number().min(-20).max(30).default(8),
    /** `auto` : `morphology` avec le moteur d'anatomie `structured`, `classic` sinon. */
    engine: z.enum(['auto', 'classic', 'morphology']).default('auto'),
    family: EarFamily.default('human'),
    /** Mélange : poids (0–1) d'autres familles ; la famille principale prend le reste. Clés triées → résultat déterministe. */
    blend: z.record(EarFamily, Unit).default({}),
    seed: z.number().int().min(0).max(0x7fffffff).default(0),
    /** Alignement sur les repères du visage : 1 = exact (racine de l'hélix sur la ligne des yeux, bas du lobule sur `lobuleLine`), 0 = libre.
     * `lobuleLine` : ligne visée par le bas du lobule. `nose-base` (défaut, anatomie réelle : le bas du lobule est au niveau de la base du nez) ;
     * `mouth` = ancienne consigne (ligne de séparation des lèvres), conservée pour comparaison : elle donne des oreilles ≈ 0,41 H, trop grandes. */
    anchors: z.object({ eye: Unit.default(1), mouth: Unit.default(1), lobuleLine: z.enum(['nose-base', 'mouth']).default('nose-base'), crusLevel: z.number().min(0.2).max(0.34).default(0.26) }).strict().default({}),
    /** Attache au crâne : ouverture (degrés d'écartement du pavillon), inclinaison avant-arrière, rotation locale, échelle relative, enfoncement dans le contour. */
    attach: z
      .object({
        openingDeg: z.number().min(5).max(60).default(24),
        pitchDeg: z.number().min(-15).max(15).default(0),
        rotationDeg: z.number().min(-20).max(20).default(0),
        scale: z.number().min(0.7).max(1.4).default(1),
        insertion: Unit.default(0.5),
      })
      .strict()
      .default({}),
    morph: EarMorph.default({}),
    /** Grammaire artistique (§8) : exagération, fidélité anatomique, angularité, douceur, asymétrie, densité des détails ; `look` = style de rendu. */
    style: z
      .object({
        exaggeration: Unit.default(0),
        fidelity: Unit.default(0.8),
        angularity: Unit.default(0),
        softness: Unit.default(0.5),
        asymmetry: Unit.default(0.12),
        detail: Unit.default(0.7),
        look: z.enum(['realistic', 'anime']).default('realistic'),
      })
      .strict()
      .default({}),
    /** Matériau : indépendant de la géométrie. `tint` null = dérivé de la peau du visage. */
    material: z
      .object({ kind: EarMaterialKind.optional(), translucency: Unit.default(0.5), roughness: Unit.default(0.55), tint: Hex.nullable().default(null), glow: Unit.default(0) })
      .strict()
      .default({}),
    extensions: z.array(EarExtension).max(6).default([]),
    piercings: z.array(EarPiercing).max(5).default([]),
  })
  .strict();
export type FaceEars = z.infer<typeof FaceEars>;
