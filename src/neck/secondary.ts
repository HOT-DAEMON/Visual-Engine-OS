import { clamp } from '../core/math';

/**
 * NECK-M09 — MOUVEMENT SECONDAIRE : inertie contrôlée des tissus mous (fanon) et des accessoires pendants (queue d'écharpe). Le tissu est un RESSORT AMORTI
 * attaché à la tête ; l'accélération de la tête le pousse en sens inverse : x'' = −ω²·x − 2ζω·x' − gain·a (intégration d'Euler semi-implicite, stable pour dt ≤ 1/30 s).
 * Pur et déterministe. Le moteur de cou ne porte pas le temps : une animation appelle `secondaryTrack` sur sa suite de tangages puis règle `pose.tissueLag`
 * image par image ; le rendu lit cette valeur (−1…+1, 0 = au repos). Plumes, fourrure et bijoux ne sont PAS couverts (docs/NECK-REMAINING.md).
 */
export interface SecondaryParams {
  /** Pulsation propre (rad/s) : plus grande = tissu plus ferme. */
  readonly omega: number;
  /** Rapport d'amortissement : < 1 oscille, 1 revient sans dépasser. */
  readonly zeta: number;
  /** Couplage accélération de la tête → tissu. */
  readonly gain: number;
}
export const SECONDARY_DEFAULT: SecondaryParams = { omega: 9, zeta: 0.3, gain: 1 };
export interface TissueState { readonly x: number; readonly v: number }

export function secondaryStep(s: TissueState, accel: number, dt: number, p: SecondaryParams = SECONDARY_DEFAULT): TissueState {
  const a = -p.omega * p.omega * s.x - 2 * p.zeta * p.omega * s.v - p.gain * accel;
  const v = s.v + a * dt;
  return { x: clamp(s.x + v * dt, -1, 1), v };
}

/** Décalage du tissu à chaque image pour une suite de tangages de tête (degrés) échantillonnée à `dt` secondes. L'accélération est normalisée à 600 °/s². */
export function secondaryTrack(pitchDeg: readonly number[], dt: number, p: SecondaryParams = SECONDARY_DEFAULT): number[] {
  let s: TissueState = { x: 0, v: 0 };
  return pitchDeg.map((_, i) => {
    const prev = pitchDeg[Math.max(0, i - 1)]!, cur = pitchDeg[i]!, next = pitchDeg[Math.min(pitchDeg.length - 1, i + 1)]!;
    s = secondaryStep(s, (next - 2 * cur + prev) / (dt * dt) / 600, dt, p);
    return s.x;
  });
}
