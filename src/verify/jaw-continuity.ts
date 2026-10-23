import { cubicAt, type Vec } from '../geometry/eye/primitives';
import type { FaceLandmarks } from '../face/landmarks';
import { check, type Check } from './types';

/**
 * Mesures de la SILHOUETTE du bas du visage (corps de la mandibule → menton), lues sur le contour RÉEL (jamais sur les paramètres).
 *  - concavityDeg : somme (°) des rotations de tangente à contre-sens de la rotation générale. Convexe = 0 ; un menton « décollé » (creux sous la mâchoire
 *                   puis goutte pendante) donnait 30–80° avant la correction de continuité.
 *  - teardrop     : demi-largeur à 25 % de la hauteur de la symphyse au-dessus du bas, rapportée à la demi-largeur du coin du menton (ellipse = 0,66 ; goutte < 0,30).
 *  - chordDeg     : pente (° depuis la verticale) de la corde coin de mâchoire → coin du menton (90° = mâchoire horizontale : épaule plate).
 *  - tipRadius    : rayon de courbure minimal du bas du menton, fraction de W (pointe arrondie, jamais une arête).
 */
export interface JawSilhouetteMetrics { readonly concavityDeg: number; readonly teardrop: number; readonly chordDeg: number; readonly tipRadius: number }

export function jawSilhouetteMetrics(lm: FaceLandmarks): JawSilhouetteMetrics {
  const o = lm.outline;
  // Segments [crâne, ramus, coin de mâchoire, corps, symphyse] : la silhouette mesurée commence au corps (le coin de mâchoire est un angle voulu).
  const pts: Vec[] = [];
  for (const c of o.right.slice(3)) for (let i = 0; i <= 80; i++) pts.push(cubicAt(c.p0, c.p1, c.p2, c.p3, i / 80));
  const turns: number[] = []; const steps: number[] = [];
  for (let i = 2; i < pts.length; i++) {
    const a = pts[i - 2] as Vec; const b = pts[i - 1] as Vec; const c = pts[i] as Vec;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y); const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    turns.push(Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)));
    steps.push((l1 + l2) / 2);
  }
  const sg = turns.reduce((s, t) => s + t, 0) >= 0 ? 1 : -1;
  const concavityDeg = (turns.reduce((s, t) => s + (t * sg < -1e-4 ? -t * sg : 0), 0) * 180) / Math.PI;
  const C = o.keys.chinCorner; const B = o.keys.bottom; const G = o.keys.gonion;
  const tail = B.y - C.y;
  // Demi-largeur à la hauteur y : dernier segment [pts[i-1], pts[i]] traversé (la silhouette est monotone en y).
  const hw = (y: number): number => { let r = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1] as Vec; const b = pts[i] as Vec; if (b.y > a.y && y >= a.y && y <= b.y) r = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y); } return r; };
  const teardrop = hw(B.y - 0.25 * tail) / Math.max(1e-6, o.chinHalf);
  const chordDeg = (Math.atan2(G.x - C.x, Math.max(1e-6, C.y - G.y)) * 180) / Math.PI;
  // Rayon minimal sur la symphyse seule (les 80 derniers points : le bas du menton).
  const n = turns.length; let minR = Infinity;
  for (let i = Math.max(0, n - 80); i < n; i++) { const t = Math.abs(turns[i] as number); if (t > 1e-5) minR = Math.min(minR, (steps[i] as number) / t); }
  return { concavityDeg, teardrop, chordDeg, tipRadius: minR / lm.W };
}

/** Seuils de la silhouette : un seul endroit, lu par les contrôles ET par les tests. */
export const JAW_LIMITS = { concavityDeg: 2, teardropMin: 0.3, chordDegMax: 72, tipRadiusMin: 0.015 } as const;

/** Trois couches : géométrique (convexité), anatomique (pente de la mâchoire, menton ≥ droite mandibule), style (pas de goutte, pointe arrondie). */
export function checkJawSilhouette(lm: FaceLandmarks): Check[] {
  const m = jawSilhouetteMetrics(lm);
  const o = lm.outline;
  return [
    check('geometry', 'jaw-silhouette-convex', '<=', m.concavityDeg, JAW_LIMITS.concavityDeg, 'le contour mandibule → menton a un creux (menton décollé de la mâchoire)'),
    check('anatomy', 'chin-not-narrower-than-mandible-line', '>=', o.chinHalf, o.chinHalfRequested > o.chinHalf ? o.chinHalf : 0, 'le menton est plus étroit que la droite mandibule → symphyse'),
    check('anatomy', 'jaw-line-slope', '<=', m.chordDeg, JAW_LIMITS.chordDegMax, 'la ligne de la mâchoire est quasi horizontale (épaule plate sous l\'angle)', 'warn'),
    check('style', 'chin-not-teardrop', '>=', m.teardrop, JAW_LIMITS.teardropMin, 'silhouette de menton en goutte d\'eau pendante'),
    check('style', 'chin-tip-rounded', '>=', m.tipRadius, JAW_LIMITS.tipRadiusMin, 'le bas du menton est une arête (rayon de pointe trop petit)'),
  ];
}
