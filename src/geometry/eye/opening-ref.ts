/**
 * Facteurs MESURÉS qui recalent l'enveloppe « amande » sur les références (references/eyes/measures.json, extraction `scripts/eye-refs/extract.py`).
 *
 * Méthode : profils haut/bas de 3 yeux de face (réfs 04, 07, 11 ; 10a/10b sont des vues 3/4 et ne servent pas ici), normalisés par leur maximum puis
 * moyennés ; ajustement (Powell, bornes physiques) des six facteurs ci-dessous qui multiplient les décalages des contrôles de la base procédurale.
 * Erreur quadratique moyenne vs profil de référence : 0,0192 (avant) -> 0,0020 (après) ; pic de la paupière haute à 0,55, creux de la basse 0,45 -> 0,55
 * (références : 0,46 / 0,56 / 0,62, moyenne ≈ 0,55). La hauteur de l'apex reste exactement `hEff × upperFraction` (pénalité dans l'ajustement).
 *
 * Aucune valeur de forme n'est inventée ici : `tests/eye-ref-measures.test.ts` recalcule ces profils depuis measures.json et échoue si l'enveloppe dérive.
 */
export interface EnvelopeRefFactors {
  /** u2 (contrôle haut-externe) : multiplicateur du décalage horizontal / vertical. */
  readonly u2dx: number;
  readonly u2dy: number;
  /** l1 (contrôle bas-externe). */
  readonly l1dx: number;
  readonly l1dy: number;
  /** l2 (contrôle bas-interne) : plus long et plus plat => la paupière basse monte doucement depuis un canthus interne plus aigu. */
  readonly l2dx: number;
  readonly l2dy: number;
}

export const NEUTRAL_REF: EnvelopeRefFactors = { u2dx: 1, u2dy: 1, l1dx: 1, l1dy: 1, l2dx: 1, l2dy: 1 };

/** Amande mesurée (voir en-tête). Appliquée à almond / sharp / drooping / compressed ; 'round' (dessiné à la main) reste neutre. */
export const ALMOND_REF: EnvelopeRefFactors = { u2dx: 0.88, u2dy: 1.01, l1dx: 0.63, l1dy: 1.09, l2dx: 1.95, l2dy: 0.85 };

/** Références utilisées pour l'ajustement (clés de measures.json). */
export const ALMOND_REF_SOURCES = ['04', '07', '11'] as const;

/**
 * Corridor de référence (même mesure : moyenne des profils NORMALISÉS PAR LEUR MAX des réfs 04/07/11 ; `sd` = écart-type entre références, plancher 0,03).
 * Sert à `verifyEye` (couche style) : un œil « naturel » dont le profil s'écarte trop de ce corridor reçoit un avertissement.
 */
export const REF_PROFILE = {
  upper: [0, 0.218, 0.426, 0.579, 0.694, 0.784, 0.855, 0.905, 0.94, 0.972, 0.986, 0.99, 0.965, 0.93, 0.892, 0.859, 0.805, 0.723, 0.567, 0.388, 0],
  lower: [0, 0.241, 0.391, 0.512, 0.592, 0.652, 0.709, 0.783, 0.856, 0.915, 0.947, 0.967, 0.952, 0.933, 0.913, 0.88, 0.804, 0.689, 0.52, 0.307, 0],
} as const;

/** Plages mesurées sur les 5 yeux tracés (04, 07, 11 de face + 10a, 10b en 3/4), élargies d'une marge de 0,05 : positions des extrema et iris. */
export const REF_RANGES = {
  upperPeakAt: [0.36, 0.65],
  lowerPeakAt: [0.41, 0.68],
  /** Diamètre de l'iris / hauteur d'ouverture (rayon mesuré 0,49–0,54 -> diamètre 0,98–1,08, marge 0,1). */
  irisOverOpeningHeight: [0.88, 1.18],
  /** Position du centre de l'iris le long de l'axe des canthi (mesurée 0,47–0,51). */
  irisCentreAlongAxis: [0.42, 0.58],
} as const;
