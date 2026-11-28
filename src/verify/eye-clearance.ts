import type { EyeSpec } from '../schema';
import { pupilKeepOut } from '../geometry/eye';
import { highlightOffsets, irisRadii } from '../render/eye/helpers';
import { hasCastShadow } from '../render/eye/flat-finish';
import type { LightVector } from '../lighting/light';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE LA PASSE 21 (reflet primaire hors de la pupille ; pli du fini `cel`).
 *  - geometry : le disque du reflet primaire par défaut ne recouvre pas une pupille non ronde (`highlight-clear-of-pupil`). Part du disque qui recouvre l'appui de la
 *    pupille dans sa direction ≤ 5 %. Une pupille presque aussi grande que l'iris n'a pas de place : avertissement, pas erreur (limite documentée).
 *  - anatomy  : le reflet reste du côté de la lumière (`highlight-keeps-light-side`) — un reflet cornéen n'est jamais opposé à sa source.
 *  - style    : en fini `cel`, l'aplat du pli doit se lire (épaisseur du pli ≥ 0,8 px à la taille de rendu), sinon l'arc reste un trait seul (`cel-crease-readable`).
 * Silencieux pour une pupille ronde simple (comportement historique) et pour un œil sans liste de reflets détaillée à pupille ronde.
 */
export const CLEAR_OVERLAP_MAX = 0.05, CEL_CREASE_MIN_PX = 0.8;

export function checkEyeClearance(raw: EyeSpec, eye: EyeSpec, headLight: LightVector, hEff: number, pxPerUnit: number): Check[] {
  const out: Check[] = [];
  const { rx, ry } = irisRadii(eye);
  const keep = pupilKeepOut(eye, rx, ry);
  if (keep && eye.highlights.list.length === 0) {
    const R = eye.highlights.primary.size * rx, o = highlightOffsets(eye, headLight).primary, d = Math.hypot(o.x, o.y);
    const u = d > 1e-9 ? { x: o.x / d, y: o.y / d } : { x: 1, y: 0 };
    let reach = 0; for (const c of keep) for (const q of c) reach = Math.max(reach, q.x * u.x + q.y * u.y);
    out.push(check('geometry', 'highlight-clear-of-pupil', '<=', R > 0 ? Math.max(0, reach + R - d) / R : 0, CLEAR_OVERLAP_MAX, 'le reflet primaire recouvre la pupille non ronde (pas de place dans l’iris pour l’en écarter)', 'warn'));
    const raw0 = highlightOffsets({ ...eye, pupil: { ...eye.pupil, shape: 'round', multiple: { ...eye.pupil.multiple, count: 1 } } }, headLight).primary;
    out.push(check('anatomy', 'highlight-keeps-light-side', '>=', o.x * raw0.x + o.y * raw0.y, 0, 'le reflet écarté de la pupille a changé de côté : un reflet cornéen reste du côté de sa source'));
  }
  if (hasCastShadow(raw) && raw.lids.crease.height > 0.005) out.push(check('style', 'cel-crease-readable', '>=', raw.lids.crease.height * hEff * pxPerUnit, CEL_CREASE_MIN_PX, 'le pli du fini cel est plus fin que 0,8 px : l’aplat ne se lit pas et l’arc reste un trait isolé', 'warn'));
  return out;
}
