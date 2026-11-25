/**
 * MESURES de `references/hair/60.jpg` (tutoriel « reflets qui suivent la direction des mèches ») — SOURCE UNIQUE des constantes du reflet transversal.
 * Produites par `scripts/hair-grammar/measure-ref60.py` (→ `artefacts/hair-engine-pass7/measures-ref60.json`) ; `tests/hair-engine-ring-measures.test.ts` vérifie que ce fichier
 * reste à moins de 3 % du JSON et que `RING` (spec-ring.ts) reste dans ces plages. Longueurs en fraction de la longueur L du ruban (ou du rayon R de l'éventail, panneau C).
 * Panneaux : A ruban horizontal, B ruban vertical, C éventail (mèches rayonnant d'un sommet), tête = illustration complète à gauche.
 * Les trois panneaux s'accordent sur l'ombre aval (creux −34 / −36 / −33 %, mi-retour +0,28 / +0,27 / +0,30 L) : la passe 6, qui avait relevé 0,20 L, mesurait autre chose (la poche sombre seule).
 */
export const MEASURED = {
  /** Étendue du reflet le long de la mèche. */
  extent: { A: 0.053, B: 0.069, C: 0.048 },
  /** Creux de luminance médiane après le reflet, relatif au niveau du ruban. */
  dip: { A: -0.339, B: -0.363, C: -0.335 },
  /** Distance du bord aval du reflet au retour à mi-niveau. */
  halfRecovery: { A: 0.28, B: 0.273, C: 0.30 },
  /** Distance du bord aval du reflet au retour à 97 % du niveau (éventail seul : les rubans A et B s'arrêtent avant). */
  fullRecovery: { C: 0.418 },
  /** Part de l'aire des cheveux occupée par le reflet (seuil strict R>190 & G>55) : tête illustrée, et panneaux A–D. */
  headHighlightShare: 0.0139,
  panelHighlightShare: { min: 0.009, max: 0.027 },
} as const;

const span = (o: Record<string, number>): { min: number; max: number } => { const v = Object.values(o); return { min: Math.min(...v), max: Math.max(...v) }; };
export const MEASURED_RANGE = { extent: span(MEASURED.extent), dip: span(MEASURED.dip), halfRecovery: span(MEASURED.halfRecovery) } as const;
