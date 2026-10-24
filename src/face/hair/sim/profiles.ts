/**
 * Profils de coiffure : (1) MASSES DE RÉGION (tempes, pattes, nuque, mèches de joue), chacune avec une longueur propre à
 * la coiffure ; (2) SILHOUETTE (volume du dessus, largeur, direction du balayage, zone rasée).
 * Toutes les longueurs sont des fractions de H (hauteur du visage) ; les largeurs, des fractions de W.
 * `sweep` : −1 = vers la gauche de l'image, +1 = vers la droite, 0 = pas de balayage latéral (l'arrière/le haut sont
 * portés par les masses de `archetypes.ts`). Les valeurs viennent des 12 références (`docs/HAIR-SIM-REFERENCES.md`).
 */
export type CheekSide = 'none' | 'left' | 'right' | 'both';

export interface RegionSpec {
  /** Masse de tempe : longueur sous le point de tempe (0 = tempe nue / rasée). */
  readonly temple: number;
  /** Patte : prolongement devant l'oreille sous la tempe (0 = aucune). */
  readonly burn: number;
  /** Nuque : longueur de la masse arrière sous le niveau de l'oreille (0 = rasée / courte). */
  readonly nape: number;
  /** Mèche de joue : longueur (0 = aucune) et côté(s). */
  readonly cheek: number;
  readonly cheekSide: CheekSide;
  /** Épaisseur relative des masses de côté (1 = normale). */
  readonly thick: number;
}

export interface SilhouetteSpec {
  /** Volume du dessus : multiplicateur de la hauteur et de la portée de la couronne (1 = neutre). */
  readonly top: number;
  /** Largeur : multiplicateur de la poussée latérale et de la masse (1 = neutre). */
  readonly width: number;
  /** Direction du balayage latéral cible (−1…1) : sert à l'écoulement ET à la vérification de silhouette. */
  readonly sweep: number;
  /** Zone rasée : côtés / nuque rasés (teinte de repousse), et hauteur du rasage (fraction de la tempe au sommet, 0–1). */
  readonly shave: { readonly sides: boolean; readonly nape: boolean; readonly height: number };
}

export interface Profile { readonly region: RegionSpec; readonly sil: SilhouetteSpec }

const R = (temple: number, burn: number, nape: number, cheek = 0, cheekSide: CheekSide = 'none', thick = 1): RegionSpec => ({ temple, burn, nape, cheek, cheekSide, thick });
const S = (top: number, width: number, sweep: number, sides = false, nape = false, height = 0): SilhouetteSpec => ({ top, width, sweep, shave: { sides, nape, height } });

export const PROFILES: Record<string, Profile> = {
  tousled: { region: R(0.07, 0.08, 0.1, 0.12, 'both'), sil: S(1.2, 1.15, 0) },
  side_sweep: { region: R(0.05, 0.04, 0.05), sil: S(1.0, 0.95, -1, false, false, 0) },
  swept_back: { region: R(0.04, 0.03, 0.06), sil: S(1.2, 0.95, 0) },
  bun_undercut: { region: R(0.0, 0, 0, 0, 'none', 0.8), sil: S(1.1, 0.85, 0, true, true, 0.55) },
  messy_bangs: { region: R(0.09, 0.1, 0.12, 0.14, 'both', 1.1), sil: S(1.0, 1.1, 0) },
  wavy_swept: { region: R(0.07, 0.07, 0.12, 0.1, 'right'), sil: S(1.15, 1.15, 0.6) },
  quiff_undercut: { region: R(0.0, 0, 0, 0.3, 'right', 0.8), sil: S(1.4, 0.85, 0, true, true, 0.5) },
  braid_updo: { region: R(0.05, 0.04, 0.08, 0.22, 'left'), sil: S(1.0, 1.0, 0.8) },
  fluffy_messy: { region: R(0.08, 0.08, 0.08, 0.09, 'both', 1.2), sil: S(1.3, 1.35, 0) },
  messy_long_bangs: { region: R(0.1, 0.12, 0.14, 0.2, 'both', 1.1), sil: S(1.0, 1.1, 0) },
  pompadour_strand: { region: R(0.03, 0.02, 0.04, 0, 'none', 0.8), sil: S(1.35, 0.9, 0, true, false, 0.3) },
  cornrows_side: { region: R(0.03, 0, 0.04, 0, 'none', 0.8), sil: S(0.8, 0.9, 0.9) },
  rebel_lock: { region: R(0.05, 0.04, 0.06), sil: S(1.0, 1.0, 0.1) },
  twintails: { region: R(0.06, 0.06, 0.08, 0.1, 'both'), sil: S(0.9, 1.0, 0) },
  hime: { region: R(0.14, 0.22, 0.3, 0.28, 'both', 1.3), sil: S(0.95, 1.2, 0) },
};

/** Profil neutre : aucune masse de région, silhouette inchangée. */
export const NEUTRAL: Profile = { region: R(0, 0, 0), sil: S(1, 1, 0) };
export const profileOf = (archetype: string): Profile => PROFILES[archetype] ?? NEUTRAL;
