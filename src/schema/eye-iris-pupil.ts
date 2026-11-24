import { z } from 'zod';
import { Hex, Unit } from './primitives';
import { ColorSource, MaterialRef } from './color-material';
import { HighlightItem } from './eye-highlights';
import { IrisLayer } from './eye-iris-layers';
import { PUPIL_SHAPES, PupilCenter, PupilDeform, PupilEdge, PupilLobes, PupilMultiple, PupilResponse } from './eye-pupil-profile';

/**
 * Iris détaillé (opt-in, `null` par défaut : rendu historique inchangé). Chaque couche reprend un
 * élément réel ou stylisé de l'iris, du centre vers le bord : zone pupillaire, collerette (anneau
 * irrégulier), fibres du stroma à deux échelles, cryptes, « flammes » d'accent, assombrissement
 * limbique, ombre portée de la paupière haute, lueur basse, halo de pupille et scintillements.
 * Les couleurs dérivent du matériau de l'iris ; seuls l'accent, la zone pupillaire et la lueur
 * peuvent être imposés. Tout est déterministe (seed de l'œil).
 */
export const IrisDetail = z
  .object({
    /** Richesse globale (nombre de fibres/hachures). */
    density: Unit.default(0.7),
    /** Contraste des fibres (opacité claire/sombre). */
    contrast: Unit.default(0.6),
    /** Collerette : anneau en dents de scie autour de la pupille. null : aucune. */
    collarette: z
      .object({
        /** Rayon, en fraction du rayon de l'iris (toujours au-delà de la pupille). */
        radius: z.number().min(0.3).max(0.85).default(0.55),
        irregularity: Unit.default(0.55),
        opacity: Unit.default(0.65),
      })
      .strict()
      .nullable()
      .default({}),
    /** Zone pupillaire (entre pupille et collerette). null : aucune. */
    innerZone: z
      .object({
        /** null : version éclaircie du centre de l'iris. */
        color: Hex.nullable().default(null),
        strength: Unit.default(0.5),
      })
      .strict()
      .nullable()
      .default({}),
    crypts: z.number().int().min(0).max(24).default(10),
    /** Flammes autour de la pupille (motif décoratif, hétérochromie centrale). null : aucune. */
    accent: z
      .object({
        color: Hex,
        /** Étendue vers le bord, en fraction de l'espace pupille → bord. */
        reach: z.number().min(0.1).max(1).default(0.5),
        spikes: z.number().int().min(6).max(48).default(22),
        opacity: Unit.default(0.85),
      })
      .strict()
      .nullable()
      .default(null),
    limbal: z
      .object({
        /** Largeur de la zone assombrie, en fraction du rayon. */
        width: z.number().min(0.05).max(0.5).default(0.24),
        strength: Unit.default(0.7),
      })
      .strict()
      .default({}),
    /** Ombre de la paupière haute sur l'iris (haut de l'iris plus sombre). */
    topShade: Unit.default(0.4),
    /** Lueur basse de l'iris (lumière qui traverse la cornée). null : aucune. */
    bottomGlow: z
      .object({ color: Hex.nullable().default(null), strength: Unit.default(0.5) })
      .strict()
      .nullable()
      .default({}),
    /** Halo clair autour de la pupille. */
    pupilHalo: Unit.default(0.35),
    /** Petits points de lumière dispersés dans la moitié basse. */
    sparkles: z.number().int().min(0).max(16).default(0),
    /**
     * FACETTES (cristal / gemme / prisme) : couronnes de facettes quadrilatères irrégulières (graine de l'œil), chacune d'un ton propre tiré de la palette de
     * l'iris, avec un biseau clair sur l'arête haute-gauche. Absent : aucune (comportement historique). Dessiné sous les fibres, sous la pupille.
     */
    facets: z
      .object({
        /** Facettes par couronne. */
        count: z.number().int().min(6).max(36).default(16),
        /** Nombre de couronnes concentriques entre la pupille et le limbe. */
        rings: z.number().int().min(1).max(4).default(2),
        /** Écart de ton entre facettes voisines et netteté du biseau. */
        contrast: Unit.default(0.6),
        /** Dispersion prismatique (opt-in, 0 = aucune) : liseré spectral (rouge -> bleu selon l'angle de la facette) sur l'arête externe de chaque facette et son contre-liseré complémentaire plus bas ; opacité = 0,75 × valeur. */
        dispersion: Unit.default(0),
        /** Rayons de lumière (opt-in, 0 = aucun) : nombre de faisceaux fins issus du bord haut-gauche de l'iris (côté de la lumière) qui traversent l'iris ; largeur et opacité tirées par une graine dédiée. */
        rays: z.number().int().min(0).max(12).default(0),
        /** Taille de gemme (passe 12, opt-in, 0 = couronnes régulières historiques) : facettes TAILLÉES = diagramme de puissance (Laguerre-Voronoï) de `count × rings` graines dont les rayons suivent une loi log-normale d'écart `0,5 + 0,6 × valeur` ; arêtes franches, table lumineuse sur une facette sur trois, biseau côté lumière. Réf. 07 : cellules très inégales (CV des aires 1,77). */
        cut: Unit.default(0),
        /** Éclats (passe 16, opt-in, 0 = aucun ; réf. 07) : part des facettes taillées FENDUE par une corde passant par leur centroïde en deux éclats triangulaires de tons distincts (facettes étroites et aiguës de la gemme). Sans effet si `cut` = 0. */
        shard: Unit.default(0),
        /** Poussière de gemme (passe 16, opt-in, 0 = aucune ; réf. 07) : jusqu'à 60 grains en losange, turquoise clair, concentrés côté lumière (haut-gauche) de la couronne de facettes. Sans effet si `cut` = 0. */
        dust: Unit.default(0),
      })
      .strict()
      .optional(),
    /**
     * BULLES (cristal, eau, givre) : petites sphères translucides à liseré clair, reflet interne et croissant d'ombre, groupées dans la partie basse de l'iris
     * (ou partout). Absent : aucune. Dessinées au-dessus de tout le détail d'iris, sous la pupille.
     */
    bubbles: z
      .object({
        count: z.number().int().min(2).max(28).default(10),
        /** Rayon moyen d'une bulle, en fraction du rayon horizontal de l'iris. */
        size: z.number().min(0.03).max(0.2).default(0.08),
        opacity: Unit.default(0.8),
        zone: z.enum(['lower', 'all']).default('lower'),
        /** Netteté (passe 11, opt-in, 0 = rendu historique) : bulle à CONTOUR SOMBRE net + liseré interne clair + croissant caustique (lumière focalisée du côté opposé au reflet) + reflet spéculaire ponctuel. Réf. 07. */
        crisp: Unit.default(0),
        /** Dispersion des tailles (passe 16, opt-in, 0 = tailles historiques 0,55–1,25 × `size`) : loi en puissance, beaucoup de petites bulles et quelques grosses (grappes de la réf. 07). */
        sizeSpread: Unit.default(0),
        /** Force du contour sombre d'une bulle `crisp` (1 = historique ; 0,3 = parois discrètes de la réf. 07). */
        rim: Unit.default(1),
      })
      .strict()
      .optional(),
    /**
     * ARC-EN-CIEL PRISMATIQUE (passe 11, opt-in) : secteur d'iris traversé par le SPECTRE (rouge -> violet selon l'angle), avec des stries radiales fines
     * (lumière dispersée par la cristallisation). Réf. 04 : magenta / violet en bas à gauche, jaune-vert en bas, turquoise en haut à droite.
     * Dessiné au-dessus des facettes, sous la collerette. Absent : aucun.
     */
    rainbow: z
      .object({
        /** Centre du secteur (0° = haut, horaire). */
        angleDeg: z.number().min(-360).max(360).default(225),
        /** Ouverture angulaire (deg). */
        span: z.number().min(20).max(360).default(120),
        /** Rayons intérieur / extérieur du secteur, en fraction du rayon de l'iris. */
        inner: z.number().min(0.1).max(0.9).default(0.35),
        outer: z.number().min(0.3).max(0.99).default(0.95),
        /** Teinte de départ et d'arrivée (deg, 0 = rouge, 270 = violet) : le spectre est parcouru de `hueFrom` à `hueTo` sur l'ouverture. */
        hueFrom: z.number().min(0).max(360).default(300),
        hueTo: z.number().min(0).max(360).default(60),
        /** Stries radiales de dispersion (nombre) et opacité globale. */
        streaks: z.number().int().min(0).max(80).default(24),
        opacity: Unit.default(0.7),
      })
      .strict()
      .optional(),
    /**
     * VIDES SOMBRES (passe 12, opt-in) : anneaux de noir profond dessinés APRÈS les fibres, facettes et flammes (les couches de couleur sont recouvertes par les fibres claires : mesuré,
     * part sombre de l'émeraude 0,011 pour 0,101 de référence malgré deux couches sombres). Chaque vide : fondu doux sur 15 % de sa largeur de chaque côté. Réf. 07 / 10a / 10b.
     */
    voids: z
      .array(z.object({ inner: z.number().min(0).max(0.95), outer: z.number().min(0.05).max(1), strength: Unit.default(0.8) }).strict())
      .max(3)
      .optional(),
    /**
     * FENTES RADIALES SOMBRES (passe 12, opt-in ; réf. 04 : ≈ 33 fentes persistantes de 2,75°, profondeur de luminance ≈ 64) : fuseaux sombres effilés de la pupille vers le limbe, à angles tirés par la graine.
     * `long` fentes pleine longueur et plus larges (la croix de la réf. 04) s'ajoutent aux `count` fentes courtes. Dessinées au-dessus des couleurs et des facettes, sous la collerette.
     */
    slits: z
      .object({
        count: z.number().int().min(4).max(64).default(32),
        long: z.number().int().min(0).max(8).default(0),
        /** Largeur angulaire au pied de la fente (deg). */
        widthDeg: z.number().min(0.5).max(8).default(2.8),
        /** Opacité du noir (0–1). */
        depth: Unit.default(0.8),
        /** Rayons de départ / d'arrivée (fraction du rayon de l'iris). */
        inner: z.number().min(0.1).max(0.9).default(0.3),
        outer: z.number().min(0.3).max(0.99).default(0.92),
        /** Effilement : 0 = largeur constante, 1 = pointe au bout externe. */
        taper: Unit.default(0.6),
        /** Courbure (passe 13) : dérive angulaire de la fente vers l'extérieur, en degrés par unité de rayon d'iris (réf. 04 : 5,8 ° / ρ mesurés, signe constant = tourbillon). 0 : fentes droites. */
        curve: z.number().min(-40).max(40).default(0),
      })
      .strict()
      .optional(),
    /**
     * ANNEAU À ARCS (passe 12, opt-in ; réf. 10b : anneau cyan segmenté en ≈ 9 tirets à r ≈ 0,7, réf. 10a : anneau feu) : `count` arcs lumineux sur le cercle `ringRho`, de largeur `width` (fraction du rayon),
     * `duty` = part remplie de chaque secteur ; un halo large et doux double le trait.
     */
    arcs: z
      .object({
        ringRho: z.number().min(0.15).max(0.95).default(0.7),
        width: z.number().min(0.01).max(0.2).default(0.05),
        count: z.number().int().min(3).max(48).default(9),
        duty: z.number().min(0.2).max(1).default(0.6),
        color: Hex.nullable().default(null),
        opacity: Unit.default(0.85),
      })
      .strict()
      .optional(),
    /**
     * BRAISES (passe 12, opt-in ; réf. 10a, 04) : étincelles brillantes tirées autour de `ringRho` (écart `spread`), allongées dans le sens radial (`streak`), avec halo.
     * `color` null : version éclaircie de la palette.
     */
    embers: z
      .object({
        count: z.number().int().min(4).max(160).default(40),
        ringRho: z.number().min(0.1).max(0.95).default(0.45),
        spread: z.number().min(0.02).max(0.5).default(0.2),
        /** Rayon d'une braise, en fraction du rayon horizontal de l'iris. */
        size: z.number().min(0.004).max(0.06).default(0.014),
        streak: Unit.default(0.5),
        opacity: Unit.default(0.85),
        color: Hex.nullable().default(null),
        /** Forme (passe 16) : `capsule` historique, ou `lance` = losange pointu à coeur blanc (étincelles de la réf. 10a). */
        shape: z.enum(['capsule', 'lance']).default('capsule'),
        /** Part (0–1, opt-in) des braises éparpillées sur tout l'iris au lieu d'être groupées autour de `ringRho` (étincelles dans la zone sombre, réf. 10a). */
        scatter: Unit.default(0),
      })
      .strict()
      .optional(),
  })
  .strict();

export const Iris = z
  .object({
    radius: z.number().min(0.15).max(0.7).default(0.46),
    aspect: z.number().min(0.7).max(1.8).default(1.12),
    material: MaterialRef.default({
      base: {
        type: 'radial',
        stops: [
          { offset: 0, color: '#9be7ff' },
          { offset: 0.55, color: '#2f8fbf' },
          { offset: 1, color: '#0f2f5c' },
        ],
      },
      roughness: 0.3,
      clearcoat: 0.3,
    }),
    fibers: z.number().int().min(0).max(120).default(48),
    limbalRing: Unit.default(0.55),
    glow: z.object({ color: Hex, strength: Unit }).strict().nullable().default({ color: '#bff3ff', strength: 0.55 }),
    /** Iris détaillé — voir `IrisDetail`. null : aucun (comportement historique). */
    detail: IrisDetail.nullable().default(null),
    /** Couches de couleur à masques/gradients (EYE-04) — voir `eye-iris-layers.ts`. Vide : aucune (comportement historique). */
    layers: z.array(IrisLayer).max(8).default([]),
    /**
     * VIBRANCE (passe 11, opt-in, 0 = aucun filtre : rendu historique) : sature le disque de l'iris (couches, fibres, détail ; pas la pupille ni les reflets)
     * par une matrice de couleur de saturation 1 + 1,6 × valeur. Réfs 04 / 07 / 08 / 10 : pics saturés à 0,72–0,79 contre 0,41–0,65 pour les couches
     * superposées (fibres claires, voile de limbe) qui lavent les teintes.
     */
    vibrance: Unit.default(0),
    /**
     * LUMINOSITÉ DES DEMI-TEINTES (passe 13, opt-in, 0 = aucun filtre : rendu historique) : courbe à genou appliquée au disque de l'iris (pas la pupille ni les reflets) : identité sous 0,35 et en 1,
     * bosse sinusoïdale de hauteur 0,4 × valeur au milieu. Les noirs (part sombre, L < 50) et les blancs restent en place ; seules les teintes moyennes montent. Réfs 04 / 07 / 10 : luminance moyenne de 126 / 129 / 89 / 103, le moteur sous elles de 14 à 22 (couleurs plates dans les zones claires).
     */
    lift: Unit.default(0),
  })
  .strict();

/**
 * Contour concentrique de la pupille. Plusieurs contours (jusqu'à 3) s'empilent vers l'extérieur,
 * chacun avec sa propre couleur/épaisseur/opacité — par ex. un fin liseré clair juste au bord de la
 * pupille, puis un anneau plus sombre un peu plus loin.
 */
export const PupilOutline = z
  .object({
    color: Hex,
    /** Épaisseur du trait, en fraction du rayon horizontal de la pupille. */
    width: z.number().min(0.01).max(0.4).default(0.08),
    opacity: Unit.default(1),
  })
  .strict();

export const Pupil = z
  .object({
    shape: z.enum(PUPIL_SHAPES).default('round'),
    /** Rayon / rayon d'iris. Plancher 0,08 (passe 9) : les réfs 06 et 09 mesurent 0,10 (pupille minuscule, collerette vive) ; l'ancien plancher 0,12 les refusait. */
    size: z.number().min(0.08).max(0.7).default(0.36),
    /** false : aucune pupille dessinée (l'iris reste plein) — état explicitement invisible. */
    visible: z.boolean().default(true),
    /**
     * Remplissage : uni, en dégradé linéaire (orientable via `angleDeg`, pour un effet de niveau —
     * ex. moitié claire/moitié sombre selon une direction choisie) ou radial (plusieurs tons
     * concentriques). Remplace l'ancien champ `color` (toujours un simple aplat) par la même
     * richesse que l'iris ou la sclère : plusieurs couleurs, orientables, avec plusieurs paliers.
     */
    fill: ColorSource.default({ type: 'solid', color: '#07090f' }),
    /** 0 à 3 contours concentriques, chacun de sa propre couleur — voir `PupilOutline`. */
    outlines: z.array(PupilOutline).max(3).default([]),
    /** EYE-05D : rotation de la forme autour de son centre (degrés). */
    orientationDeg: z.number().min(-180).max(180).default(0),
    center: PupilCenter.default({}),
    edge: PupilEdge.default({}),
    response: PupilResponse.default({}),
    /** Sommets des profils `star` / `polygon` / `cross`. */
    lobes: PupilLobes.default({}),
    multiple: PupilMultiple.default({}),
    deform: PupilDeform.default({}),
  })
  .strict();

export const Highlight = z.object({ size: z.number().min(0.03).max(0.5), opacity: Unit }).strict();

export const Highlights = z
  .object({
    primary: Highlight.default({ size: 0.24, opacity: 1 }),
    secondary: Highlight.nullable().default({ size: 0.11, opacity: 0.75 }),
    /** Reflets détaillés (jusqu'à 6). Liste non vide : REMPLACE `primary`/`secondary` (voir `eye-highlights.ts`). */
    list: z.array(HighlightItem).max(12).default([]),
  })
  .strict();
