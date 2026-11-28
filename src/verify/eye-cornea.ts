import { EDGE_MAX_DEV, cubicAt, eyeEdges, type OpeningGeometry, type Vec } from '../geometry/eye';
import { warpOf } from '../render/eye/cornea';
import { resolveEye, withAutoLod } from '../render/eye/eye';
import { isFlat } from '../render/eye/flat-finish';
import type { EyeSpec } from '../schema';
import { check, type Check } from './types';

/**
 * COUCHES « CORNÉE » (EYE-03 / OPT-02) et « BORDS PALPÉBRAUX » (EYE-07E) de `verifyEye` — trois familles, calculées sur les MÊMES fonctions que le rendu :
 *   geometry : la loi de réfraction est monotone et fixe le limbe (`warp(1) = 1`) ; le bord irrégulier reste à ≤ EDGE_MAX_DEV × hEff du bord de l'enveloppe et ne se recoupe pas ;
 *   anatomy  : l'agrandissement apparent de la pupille reste humain (≈ 1,13 ; seuil 1,35 = exagération assumée au-delà de `refraction` ≈ 1,6) ; un bord ne dévie jamais plus que la
 *              ligne des cils ne peut le masquer (même borne) ;
 *   style    : une cornée déclarée doit se VOIR (écart de loi ≥ 0,5 % du rayon : sinon paramètre orphelin) ; un œil `flat` (trait net) garde des bords peu irréguliers (≤ 0,35).
 * Le pendant en pixels (la pupille mesurée sur l'image suit la loi) est dans scripts/lib/verify-eye-cornea-render.ts.
 */
export const CORNEA_PUPIL_MAGNIFICATION_MAX = 1.35;
export const CORNEA_VISIBLE_MIN = 0.005;
export const FLAT_EDGE_IRREGULARITY_MAX = 0.35;

const ccw = (a: Vec, b: Vec, c: Vec): number => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
const crosses = (a: Vec, b: Vec, c: Vec, d: Vec): boolean => ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0;

export function checkEyeCornea(raw: EyeSpec, eye: EyeSpec, g: OpeningGeometry, sceneIntensity?: number): Check[] {
  const out: Check[] = [];
  const co = eye.cornea;
  if (co) {
    const w = warpOf(eye);
    let down = 0; let gap = 0; let prev = 0;
    for (let i = 1; i <= 64; i++) { const v = w(i / 64); if (v < prev - 1e-9) down++; gap = Math.max(gap, Math.abs(v - i / 64)); prev = v; }
    out.push(check('geometry', 'cornea-warp-monotone', '==', down, 0, 'la loi de réfraction de la cornée n’est pas monotone (l’iris se replierait sur lui-même)'));
    out.push(check('geometry', 'cornea-limbus-fixed', '==', w(1), 1, 'le limbe n’est plus le bord apparent de l’iris (taille de l’iris modifiée)'));
    const un = resolveEye({ ...raw, cornea: null }, sceneIntensity).pupil.size; const mag = un > 0 ? eye.pupil.size / un : 1;
    out.push(check('anatomy', 'cornea-pupil-magnification', '<=', mag, CORNEA_PUPIL_MAGNIFICATION_MAX, 'la pupille paraît plus de 1,35 × plus grande que sa taille vraie (humain ≈ 1,13) : réfraction exagérée', 'warn'));
    if (co.refraction > 0) out.push(check('style', 'cornea-visible', '>=', gap, CORNEA_VISIBLE_MIN, 'la cornée est déclarée mais sa loi de réfraction est invisible (< 0,5 % du rayon) : paramètres orphelins', 'warn'));
  }
  const md = eye.microdetail;
  if (md?.edge) {
    const e = eyeEdges(withAutoLod(eye).eye, g)!; // même source que le rendu (LOD résolu)
    const dense = (c: readonly [Vec, Vec, Vec, Vec]): Vec[] => Array.from({ length: 401 }, (_, i) => cubicAt(c[0], c[1], c[2], c[3], i / 400));
    const up = dense([g.pi, g.u1, g.u2, g.po]); const lo = dense([g.po, g.l1, g.l2, g.pi]);
    const dev = Math.max(...e.upper.map((p) => Math.min(...up.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))), ...e.lower.map((p) => Math.min(...lo.map((q) => Math.hypot(p.x - q.x, p.y - q.y))))) / (g.hEff || 1);
    out.push(check('geometry', 'edge-deviation-bounded', '<=', dev, EDGE_MAX_DEV * 1.05, 'le bord palpébral irrégulier s’écarte trop de l’enveloppe (l’ouverture changerait de forme)'));
    const poly = [...e.upper, ...e.lower.slice(1, -1)]; let selfX = 0;
    for (let i = 0; i < poly.length; i++) for (let j = i + 2; j < poly.length; j++) { if (i === 0 && j === poly.length - 1) continue; if (crosses(poly[i] as Vec, poly[(i + 1) % poly.length] as Vec, poly[j] as Vec, poly[(j + 1) % poly.length] as Vec)) selfX++; }
    out.push(check('geometry', 'edge-opening-simple', '==', selfX, 0, 'le contour irrégulier de l’ouverture se recoupe lui-même'));
    if (isFlat(eye)) out.push(check('style', 'edge-flat-clean', '<=', md.edge.irregularity, FLAT_EDGE_IRREGULARITY_MAX, 'un œil au trait net (finish flat) porte un bord très irrégulier : style incohérent', 'warn'));
  }
  return out;
}
