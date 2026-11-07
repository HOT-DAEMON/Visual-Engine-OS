import { z } from 'zod';
import { Unit } from './primitives';

/**
 * CONTRAT DU SYSTÈME DE COU (`src/neck/`, `src/render/neck/`) — docs/NECK-ENGINE.md.
 *
 * Il COMPLÈTE `FaceNeck` (`schema/face-extras.ts`), il ne le remplace pas : `width`, `length`, `flare`, `thickness`, `muscles`, `platysma`,
 * `cervicomentalDeg`, `shade`, `chinCoupling` restent la SOURCE UNIQUE de ces grandeurs (famille Dimensions / Profil / Musculature /
 * Graisse du TODO) ; ce fichier ne contient que ce qui n'existait pas. Aucun paramètre n'est déclaré sans effet mesuré :
 * `tests/neck-visible.test.ts` change chaque champ et exige une différence de silhouette ou de pixels.
 *
 * Cinq couches INDÉPENDANTES (TODO §3, « un profil ne dicte pas tous les paramètres ») :
 *   morphologie (dimensions, profil, orientation, asymétrie) · anatomie (musculature, tissus) · espèce · style · modificateurs.
 * Plus deux piles : déformations (opérateurs ordonnés) et surface (matériau, motif d'écailles/plaques/plumes).
 */

/** Espèce : capacités et contraintes (quels composants existent, comment la surface est distribuée). */
export const NECK_SPECIES = ['human', 'reptile', 'avian', 'dragon', 'armored', 'serpent', 'fantasy'] as const;
/** Style : priorité de lecture. `realistic` = anatomie, `caricature` = silhouette, les autres simplifient les volumes. */
export const NECK_STYLES = ['realistic', 'caricature', 'anime', 'sculpture', 'painting'] as const;
/** Motifs de surface (distribution suivant la surface, TODO §7). */
export const NECK_PATTERNS = ['smooth', 'scales', 'plates', 'feathers'] as const;
/** Règles de distribution (rangées, spirale, pavage, groupes organiques, masque). */
export const NECK_LAYOUTS = ['rows', 'spiral', 'tiling', 'clusters'] as const;
/** Stratégies de déformation (TODO §4) ; elles coexistent (`strategies` en liste). `cage` (réseau de contrôle) n'est PAS implémentée : voir docs/NECK-REMAINING.md. */
export const NECK_STRATEGIES = ['chain', 'weighted', 'centerline', 'fields'] as const;

/** Les 12 opérateurs du TODO §6 (noms exacts). */
export const NECK_OPERATORS = [
  'length_warp', 'width_profile_warp', 'depth_profile_warp', 'centerline_bend', 'local_bulge', 'local_compression',
  'asymmetric_deformation', 'muscle_exaggeration', 'fold_amplification', 'silhouette_simplification', 'topology_extension', 'surface_ripple',
] as const;

const Signed = z.number().min(-1).max(1);

/** Opérateur : `at` = position le long du cou (0 = haut/tête, 1 = base/thorax), `span` = étendue, `side` = −1 gauche · 0 deux côtés · +1 droite. */
export const NeckOperator = z
  .object({
    op: z.enum(NECK_OPERATORS),
    amount: Signed.default(0.5),
    at: Unit.default(0.5),
    span: z.number().min(0.05).max(1).default(0.4),
    side: z.union([z.literal(-1), z.literal(0), z.literal(1)]).default(0),
  })
  .strict();

export const NeckSystem = z
  .object({
    /** Famille Dimensions (le reste : `FaceNeck.width` / `length`). */
    dimensions: z
      .object({
        /** Profondeur AP du cou / sa largeur (0,85 = valeur historique du moteur de pose). */
        depthRatio: z.number().min(0.45).max(1.5).default(0.85),
        /** Largeur du HAUT du cou / `FaceNeck.width` (sous la mâchoire). */
        topWidth: z.number().min(0.55).max(1.3).default(1),
      })
      .strict()
      .default({}),
    /** Famille Profil (le reste : `FaceNeck.flare`). */
    profile: z
      .object({
        /** −1 = cône inversé (plus étroit en bas), 0 = cylindre, +1 = cône (plus large en bas) sur toute la longueur. */
        taper: Signed.default(0),
        /** Sablier : rétrécissement au tiers inférieur (cygne, cou de girafe stylisé). */
        waist: Unit.default(0),
        /** Courbure sagittale du cou (visible de profil) : + = convexe vers l'avant, − = vers l'arrière. */
        curvature: Signed.default(0),
        /** Seconde inflexion de la courbure (cou en S : cygne, dragon). */
        sCurve: Unit.default(0),
        /** 0 = section elliptique, 1 = section quasi rectangulaire arrondie (cou cuirassé, carapace). */
        crossSection: Unit.default(0),
        /** Nombre de segments visibles (1 = lisse ; >1 = anneaux/cuirasse : serpentin, cou segmenté). */
        segments: z.number().int().min(1).max(14).default(1),
      })
      .strict()
      .default({}),
    /** Famille Orientation. L'inclinaison de la TÊTE reste `deform.articulation.headPitchDeg` (source unique) ; ici : le cou lui-même. */
    orientation: z
      .object({
        /** Inclinaison du cou sur le thorax, degrés (+ = vers l'avant). */
        pitchDeg: z.number().min(-35).max(45).default(0),
        /** Inclinaison latérale du cou (oreille vers l'épaule), degrés. */
        rollDeg: z.number().min(-35).max(35).default(0),
        /** Torsion totale de la base au sommet (rotation de la section), degrés. */
        torsionDeg: z.number().min(-90).max(90).default(0),
        /** Décalage latéral de l'axe, fraction de la largeur du cou. */
        axisOffset: Signed.default(0),
      })
      .strict()
      .default({}),
    /** Famille Asymétrie. */
    asymmetry: z
      .object({
        /** + = côté droit de l'image plus massif. */
        leftRightBias: Signed.default(0),
        /** + = face antérieure plus épaisse que la nuque. */
        frontBackBias: Signed.default(0),
        /** Irrégularités locales déterministes (graine `seed`). */
        localVariation: Unit.default(0),
        seed: z.number().int().min(0).max(0xffffffff).default(1),
      })
      .strict()
      .default({}),
    /** Famille Musculature (le reste : `FaceNeck.muscles`). */
    musculature: z
      .object({
        /** Volume des trapèzes (pente nuque → épaule). */
        trapezius: Unit.default(0.5),
        /** Séparation visible entre les muscles (sillons). */
        separation: Unit.default(0.4),
        /** Visibilité des tendons (SCM à leur insertion claviculaire, câbles du cou tendu). */
        tendonVisibility: Unit.default(0.3),
        /** 0 = caché sous la peau, 1 = visible comme une anatomie d'écorché (cou tendu). */
        tension: Unit.default(0.2),
      })
      .strict()
      .default({}),
    /** Famille Graisse et plis (le reste : `FaceNeck.thickness`). */
    softTissue: z
      .object({
        foldDepth: Unit.default(0.3),
        /** 0 = plis sous le menton seulement, 1 = répartis sur toute la longueur. */
        foldDistribution: Unit.default(0.3),
        /** Fanon / double menton (tissu pendant sous la mandibule). */
        dewlap: Unit.default(0),
      })
      .strict()
      .default({}),
    /** Reliefs anatomiques (NECK-06A…06G) : visibilité forcée ; `auto` = dérivée de la morphologie et de la posture. */
    reliefs: z
      .object({
        larynx: z.union([z.literal('auto'), Unit]).default('auto'),
        hyoid: z.union([z.literal('auto'), Unit]).default('auto'),
        trachea: z.union([z.literal('auto'), Unit]).default('auto'),
        vessels: z.union([z.literal('auto'), Unit]).default('auto'),
        clavicle: z.union([z.literal('auto'), Unit]).default('auto'),
      })
      .strict()
      .default({}),
    /** Couche d'espèce. */
    species: z.enum(NECK_SPECIES).default('human'),
    /** Couche de style. */
    style: z
      .object({
        mode: z.enum(NECK_STYLES).default('realistic'),
        exaggeration: Unit.default(0),
        simplification: Unit.default(0),
        angularity: Unit.default(0),
        /** 1 = la silhouette l'emporte sur l'anatomie (détails internes atténués). */
        silhouettePriority: Unit.default(0.3),
      })
      .strict()
      .default({}),
    /** Modificateurs : âge apparent, masse corporelle, tension posturale. */
    modifiers: z
      .object({
        /** 0 = jeune, 1 = âgé (peau plus relâchée, plis, fosse sus-sternale creusée). */
        age: Unit.default(0.3),
        /** 0 = très mince, 1 = obèse : épaissit le tissu mou et estompe les reliefs. */
        mass: Unit.default(0.4),
      })
      .strict()
      .default({}),
    /** Pose (HeadPoseController → NeckDeformationController). Valeurs en degrés / fractions ; 0 = neutre. */
    pose: z
      .object({
        /** Translation de la tête sans rotation (M04), fraction de la largeur du cou : + = avant. */
        headTranslate: Signed.default(0),
        /** Compression axiale (M05) : 0 = neutre, 1 = tête dans les épaules. */
        compression: Unit.default(0),
        /** Étirement (M06) : 0 = neutre, 1 = allongé. */
        stretch: Unit.default(0),
        /** Part de la rotation de la tête que le cou suit (M03) : 0,55 = valeur historique (`TWIST`). */
        twistShare: z.number().min(0.2).max(0.9).default(0.55),
        /** Décalage instantané du tissu mou (fanon, queue d'écharpe) par inertie, −1…+1 (0 = repos) : réglé par une animation via `secondaryTrack` (M09). */
        tissueLag: Signed.default(0),
        /** Expression corporelle nommée (BodyLanguageController) ; `null` = aucune. */
        bodyLanguage: z.enum(['neutral', 'fear', 'pride', 'shame', 'defiance', 'fatigue', 'curiosity', 'anger', 'relaxed']).default('neutral'),
        /** Intensité de l'expression corporelle. */
        bodyLanguageAmount: Unit.default(0),
      })
      .strict()
      .default({}),
    /** Stratégies de déformation actives (elles coexistent, TODO §4). */
    strategies: z.array(z.enum(NECK_STRATEGIES)).min(1).default(['weighted']),
    /** Pile d'opérateurs (exécutés dans l'ordre canonique, pas dans l'ordre de la liste : voir `neck/stack.ts`). */
    operators: z.array(NeckOperator).max(24).default([]),
    /** Surface : matériau, motif et distribution (TODO §7). */
    surface: z
      .object({
        pattern: z.enum(NECK_PATTERNS).default('smooth'),
        layout: z.enum(NECK_LAYOUTS).default('rows'),
        /** Taille d'un élément, fraction de la largeur du cou. */
        size: z.number().min(0.05).max(0.6).default(0.18),
        density: Unit.default(0.6),
        /** Chevauchement des éléments (0 = jointifs, 1 = très imbriqués). */
        overlap: Unit.default(0.4),
        /** Variation de taille / d'orientation (déterministe). */
        variation: Unit.default(0.2),
        /** Ventre/gorge lisse : fraction de la face antérieure sans éléments (reptiles, dragons). */
        smoothThroat: Unit.default(0),
        /** Étirement de la peau sur les reliefs (0 = relâchée, 1 = tendue : fait ressortir les tendons). */
        skinTension: Unit.default(0.3),
        /** Teinte propre aux éléments (null = couleur de la peau, donc cohérente avec le reste du corps). */
        elementColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
      })
      .strict()
      .default({}),
    /** Éléments additionnels attachés (GEO-04), chacun avec ses propres ancrages. */
    attachments: z
      .array(
        z
          .object({
            kind: z.enum(['collar', 'crest', 'frill', 'spikes', 'scarf']),
            /** Position le long du cou (0 = haut, 1 = base). */
            at: Unit.default(0.8),
            size: z.number().min(0.05).max(1).default(0.3),
            count: z.number().int().min(1).max(24).default(8),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#8a8f9c'),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict();

export type NeckSystem = z.infer<typeof NeckSystem>;
export type NeckOperator = z.infer<typeof NeckOperator>;
