import { z } from 'zod';
import { Unit } from './primitives';

/**
 * Cheveux SIMULÉS : chaque paquet est une chaîne de points (Verlet 3D) attachée à une racine du cuir chevelu, soumise à la
 * gravité, au vent optionnel et à la collision contre le crâne / le visage / le cou / les épaules. La chute, la retombée sur
 * les tempes et le drapé en découlent ; l'anti-gravité n'existe que si `float` > 0 (volontaire).
 * Tous les défauts sont neutres : `enabled: false` ne change AUCUN rendu existant.
 */
export const HAIR_ARCHETYPES = ['none', 'tousled', 'side_sweep', 'swept_back', 'bun_undercut', 'messy_bangs', 'wavy_swept', 'quiff_undercut', 'braid_updo', 'fluffy_messy', 'messy_long_bangs', 'pompadour_strand', 'cornrows_side', 'rebel_lock', 'twintails', 'hime'] as const;

export const HairSim = z
  .object({
    enabled: z.boolean().default(false),
    /** Archétype de coiffure (silhouette lisible) ; `none` : paramètres bruts de `HairFlow`/style. */
    archetype: z.enum(HAIR_ARCHETYPES).default('none'),
    /** Gravité (0 = aucune, 1 = normale). */
    gravity: Unit.default(0.8),
    /** Anti-gravité VOLONTAIRE (0 = jamais ; > 0 : « électrocuté »). */
    float: Unit.default(0),
    /** Vent horizontal (−1 gauche … +1 droite de l'image) et amplitude. */
    wind: z.number().min(-1).max(1).default(0),
    windGust: Unit.default(0.3),
    /** Raideur d'une mèche : 0 = molle (retombe), 1 = rigide (garde sa direction de départ). */
    stiffness: Unit.default(0.5),
    /** Nombre de paquets (masse → paquets) et de brins visibles par paquet. */
    packets: z.number().int().min(4).max(160).default(72),
    strandsPerPacket: z.number().int().min(0).max(8).default(2),
    /** Plaquage au crâne : 0 = flotte, 1 = suit la surface. */
    cling: Unit.default(0.7),
    /** Règles de contact : où les cheveux peuvent REPOSER sur la peau. */
    drape: z.object({ forehead: z.boolean().default(true), ears: z.boolean().default(true), cheeks: z.boolean().default(true), shoulders: z.boolean().default(true) }).strict().default({}),
    /** Opacité des ombres portées des cheveux sur la peau (0 = aucune). */
    skinShadow: Unit.default(0.35),
    /** Longueur relative (fraction de H) ajoutée aux valeurs de l'archétype. */
    lengthBias: z.number().min(-1).max(1).default(0),
    /** Mèches en LAMES (larges, lissées) : 0 = rubans fins historiques, 1 = grandes lames de manga. */
    blade: Unit.default(0.75),
    /** Masse de volume pleine sous les mèches (silhouette lisible, jamais de crâne nu entre deux mèches). */
    mass: z.boolean().default(true),
    /** Masses de RÉGION (tempes, pattes, nuque, mèches de joue) et silhouette par archétype (dessus, largeur, balayage, zone rasée). */
    regions: z.boolean().default(false),
    /** Rendu « encre » : noir franc, masses pleines, bandes blanches continues, contours noirs. */
    ink: z.boolean().default(false),
  })
  .strict();
export type HairSim = z.infer<typeof HairSim>;
