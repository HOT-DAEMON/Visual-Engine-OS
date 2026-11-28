import type { EyeSpec } from '../../schema';
import { pupilContours, type Contour } from './pupil-shape';
import type { Vec } from './primitives';

/**
 * PASSE 21 — Reflet primaire HORS de la pupille non ronde (EYE-05 × OPT-01).
 *
 * Constat (docs/EYES-REMAINING.md, § 05) : le reflet par défaut, un grand disque posé à 0,85 du rayon d'iris vers la lumière, recouvre souvent une fente, une croix ou une
 * étoile ; les planches de preuve le réduisaient à la main. Dans les références au trait, le reflet cornéen glisse le long du limbe pour laisser la pupille lisible : il reste
 * du côté de la lumière, mais ne la masque pas.
 *
 * Règle (une seule, lue par le rendu historique, par `placeHighlights` et par `verifyEye`) : on ne touche qu'à une pupille NON ronde ou multiple (la pupille ronde garde
 * son reflet classique : SVG identique à l'octet). Autour de la direction de la lumière, on cherche le plus petit écart angulaire (≤ 70°, du côté de la lumière) tel que le
 * disque du reflet, à distance ≥ étendue de la pupille dans cette direction + son rayon, tienne encore dans l'iris. Le reflet ne se rapproche jamais du centre : il ne fait
 * que s'éloigner de la pupille. Si aucune direction ne convient (pupille presque aussi grande que l'iris), il reste à la position demandée : limite documentée.
 */
export const CLEARANCE_MAX_SWING_DEG = 70;
const STEP_DEG = 5;
const GAP = 1.04;   // le disque ne touche pas le bord de la pupille

/** Contours de la pupille à écarter, ou `null` si la pupille est ronde et simple (aucun dégagement). Repère local de l'iris. */
export function pupilKeepOut(eye: Pick<EyeSpec, 'pupil' | 'seed'>, irisRx: number, irisRy: number): readonly Contour[] | null {
  const p = eye.pupil;
  if (p.shape === 'round' && p.multiple.count === 1) return null;
  return pupilContours(p, p.size, irisRx, irisRy, eye.seed).contours;
}

/** Étendue de la pupille (fonction d'appui) dans la direction unitaire `u`. */
const reach = (contours: readonly Contour[], u: Vec): number => {
  let m = 0;
  for (const c of contours) for (const q of c) m = Math.max(m, q.x * u.x + q.y * u.y);
  return m;
};

/**
 * Position du reflet (repère local de l'iris, origine = centre de l'iris) après dégagement. `at` = position demandée, `radius` = rayon du disque
 * (au plus l'un des deux rayons du reflet : le plus grand, par prudence).
 */
export function clearHighlightOfPupil(at: Vec, radius: number, contours: readonly Contour[] | null, irisRx: number, irisRy: number): Vec {
  if (!contours || contours.length === 0) return at;
  const d0 = Math.hypot(at.x, at.y);
  const a0 = Math.atan2(at.y, at.x);
  const fits = (a: number, d: number): boolean => {
    const u = { x: Math.cos(a), y: Math.sin(a) };
    const irisReach = 1 / Math.hypot(u.x / irisRx, u.y / irisRy);   // distance du centre au bord de l'iris, dans la direction u
    const need = Math.max(d, reach(contours, u) + radius * GAP);
    return need <= irisReach - radius;
  };
  // Déjà dégagé ? (la position demandée tient, à sa distance, sans recouvrir la pupille)
  const free = (a: number, d: number): boolean => {
    const u = { x: Math.cos(a), y: Math.sin(a) };
    return d >= reach(contours, u) + radius * GAP;
  };
  if (free(a0, d0)) return at;
  for (let k = 0; k * STEP_DEG <= CLEARANCE_MAX_SWING_DEG; k++) {
    for (const sgn of k === 0 ? [1] : [1, -1]) {
      const a = a0 + sgn * k * STEP_DEG * (Math.PI / 180);
      if (!fits(a, d0)) continue;
      const u = { x: Math.cos(a), y: Math.sin(a) };
      const d = Math.max(d0, reach(contours, u) + radius * GAP);
      return { x: u.x * d, y: u.y * d };
    }
  }
  return at;
}
