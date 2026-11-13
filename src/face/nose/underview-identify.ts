import type { NoseGeometry } from './types';
import { noseView } from './underview';
import type { UnderviewModel } from './underview-model';

/**
 * IDENTIFICATION du tangage et du lacet d'un nez de référence à partir de DEUX grandeurs observées seulement (docs/NOSE-UNDERVIEW-CALIB.md) :
 *   r = rapport d'axes de l'ellipse (minor / major) ; u = |décalage latéral du sommet du triangle| / grand axe (repère propre de l'ellipse).
 * Le lacet décale la pointe (devant le plan) mais pas le sous-nez (dans le plan) : c'est ce qui rend u informatif. Le roulis, lui, n'est pas identifié
 * ici : il est LU sur l'ellipse mesurée (angle du grand axe) et n'intervient pas dans les grandeurs du repère propre.
 *
 * Aucune des grandeurs jugées ensuite (hauteur du triangle, position de sa base, dépassement du sommet) n'entre dans cette identification :
 * c'est ce qui empêche le tangage d'absorber l'erreur du modèle (défaut du protocole v1, voir docs/NOSE-UNDERVIEW.md §4).
 */
export interface ObservedView { readonly r: number; readonly u: number }
/** Échelles de normalisation (écarts-types des deux grandeurs sur l'ensemble des références). */
export interface ObservedScale { readonly sr: number; readonly su: number }
export interface IdentifiedAngles { readonly pitchDeg: number; readonly yawDeg: number; readonly misfit: number }

export const PITCH_RANGE = [0, 90] as const;
export const YAW_RANGE = [0, 60] as const;

/** Un modèle dont l'alarTop est derrière l'alarBase est ramené à la contrainte anatomique (l'aile n'est jamais derrière son pied). */
export const normaliseModel = (m: UnderviewModel): UnderviewModel => (m.alarTop < m.alarBase ? { ...m, alarTop: m.alarBase } : m);

/**
 * Cherche (tangage, lacet) minimisant l'écart normalisé sur (r, u). Trois niveaux : grille grossière (9° / 10°), ±8° / ±9° au pas 3°, puis ±2° au pas 1°.
 * Seules les vues dont le repère propre est valide (`frame.valid`) sont admises, comme pour les mesures. `null` si aucune vue valide n'existe.
 */
export function identifyAngles(nose: NoseGeometry, model: UnderviewModel, obs: ObservedView, scale: ObservedScale): IdentifiedAngles | null {
  const m = normaliseModel(model);
  const ev = (pitch: number, yaw: number): number => {
    const v = noseView(nose, pitch, yaw, m);
    if (!v.frame.valid) return Infinity;
    return ((v.ellipse.axisRatio - obs.r) / scale.sr) ** 2 + ((Math.abs(v.frame.apexUOverMajor) - obs.u) / scale.su) ** 2;
  };
  let best = { pitchDeg: 0, yawDeg: 0, misfit: Infinity };
  const scan = (p0: number, p1: number, y0: number, y1: number, sp: number, sy: number): void => {
    for (let pi = Math.max(PITCH_RANGE[0], p0); pi <= Math.min(PITCH_RANGE[1], p1); pi += sp) {
      for (let ya = Math.max(YAW_RANGE[0], y0); ya <= Math.min(YAW_RANGE[1], y1); ya += sy) {
        const e = ev(pi, ya); if (e < best.misfit) best = { pitchDeg: pi, yawDeg: ya, misfit: e };
      }
    }
  };
  scan(PITCH_RANGE[0], PITCH_RANGE[1], YAW_RANGE[0], YAW_RANGE[1], 9, 10);
  if (!Number.isFinite(best.misfit)) return null;
  scan(best.pitchDeg - 8, best.pitchDeg + 8, best.yawDeg - 9, best.yawDeg + 9, 3, 3);
  scan(best.pitchDeg - 2, best.pitchDeg + 2, best.yawDeg - 2, best.yawDeg + 2, 1, 1);
  return best;
}
