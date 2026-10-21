import type { Vec } from '../../geometry/eye/primitives';
import type { FaceLandmarks } from '../landmarks';
import type { ExpressionPulls } from './expression';

/**
 * CHAMP DE TISSU : somme de noyaux gaussiens, un par muscle qui tire. Un pli n'est pas une ligne posée sur la peau : c'est l'endroit où ce champ
 * déplace la chair le plus fort d'un point à l'autre. On déplace donc la courbe de base du pli par le champ (le pli se creuse et glisse avec l'expression),
 * et on déplace de la même façon les régions de chair (joue, lèvre) pour que tout bouge ENSEMBLE.
 */
export interface Pull {
  /** Centre du noyau (px). */
  readonly c: Vec;
  /** Déplacement au centre (px). */
  readonly v: Vec;
  /** Rayon (px) : à une distance r le déplacement vaut e⁻¹ du maximum. */
  readonly r: number;
}

export type TissueField = (q: Vec) => Vec;

/** Pulsions de l'expression (commissures, joues, lèvres) positionnées sur les repères du visage. */
export function pullsOf(e: ExpressionPulls, lm: FaceLandmarks, cheekCenters: readonly [Vec, Vec]): Pull[] {
  const { W } = lm;
  const l = lm.lips;
  const out: Pull[] = [];
  for (const [i, s] of ([-1, 1] as const).entries()) {
    // Commissure : tirée vers le haut (y négatif) et vers l'extérieur (x du signe du côté).
    out.push({ c: { x: s * l.half, y: l.cornerY }, v: { x: s * e.cornerOut, y: -e.cornerLift }, r: 0.1 * W });
    // Joue : remonte sous l'œil (bombement), noyau plus large que celui de la commissure.
    out.push({ c: cheekCenters[i] as Vec, v: { x: 0, y: -e.cheekRaise }, r: 0.09 * W });
  }
  // Lèvre supérieure retroussée ; lèvre inférieure abaissée par les dépresseurs.
  out.push({ c: { x: 0, y: l.topY }, v: { x: 0, y: -e.upperLipRaise }, r: 0.07 * W });
  out.push({ c: { x: 0, y: l.bottomY }, v: { x: 0, y: e.lowerLipDepress }, r: 0.07 * W });
  return out;
}

export function tissueField(pulls: readonly Pull[]): TissueField {
  return (q) => {
    let x = 0;
    let y = 0;
    for (const p of pulls) {
      const d2 = ((q.x - p.c.x) ** 2 + (q.y - p.c.y) ** 2) / (p.r * p.r);
      // Noyau gaussien : décroît lentement près du centre, s'éteint à ~2 rayons.
      const w = Math.exp(-d2);
      x += w * p.v.x;
      y += w * p.v.y;
    }
    return { x, y };
  };
}

/** Applique le champ à une polyligne ou un polygone. */
export const displaceAll = (pts: readonly Vec[], f: TissueField): Vec[] =>
  pts.map((q) => {
    const d = f(q);
    return { x: q.x + d.x, y: q.y + d.y };
  });
