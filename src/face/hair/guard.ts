import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt, rightSamples } from '../outline';
import type { Hairline } from './hairline';

export type GuardMode = 'cap' | 'fringe';

/**
 * Garde-fou « enfant du visage » : chaque sommet de chaque mèche (avant) passe par `project`.
 *  - sur la peau du visage, sous la limite des sourcils, il est repoussé vers l'extérieur (hors du contour,
 *    sauf la bande étroite des pattes réservée aux tempes) ;
 *  - entre la naissance des cheveux et la limite des sourcils, seule la frange est autorisée ;
 *  - jamais plus bas que `yF` = limite des sourcils − 0,008 H.
 * Conséquence : aucune mèche ne peut recouvrir un œil, quelle que soit la coiffure ou la texture.
 */
export interface Guard {
  project(v: Vec, mode?: GuardMode): Vec;
  /** Polygone entier : sommets projetés, puis arêtes subdivisées tant qu'elles traversent la zone interdite. */
  fit(poly: Vec[], mode?: GuardMode): Vec[];
  /** Limite basse (ordonnée) de la frange et de toute mèche au-dessus des yeux. */
  readonly yF: number;
  /** Largeur de la bande des pattes (px) à l'ordonnée y : 0 sous la fin des pattes. */
  sideMargin(y: number): number;
  hw(y: number): number;
}

export function makeGuard(p: FaceParams, lm: FaceLandmarks, hl: Hairline): Guard {
  const { W, H, outline } = lm;
  const samples = rightSamples(outline);
  const hw = (y: number): number => halfWidthAt(outline, y, samples);
  const yT = lm.hair.templeY;
  const sb = p.hair.sideburns;
  const yBs = Math.max(yT + 0.02 * H, Math.min(yT + (0.1 + 0.9 * sb) * (lm.eyeY - yT) * 0.8, lm.eyeY - 0.03 * H));
  const w0 = 0.03 * hw(yT);
  const wSB = (0.022 + 0.018 * sb) * W;
  const yF = lm.browLimitY - 0.008 * H;
  const sideMargin = (y: number): number => (y <= yBs ? w0 + (wSB - w0) * clamp((y - yT) / (yBs - yT), 0, 1) : 0);
  const project = (v: Vec, mode: GuardMode = 'cap'): Vec => {
    const inner = hw(v.y) - sideMargin(v.y);
    if (Math.abs(v.x) >= inner) return v;
    if (v.y > yF) return { x: (v.x < 0 ? -1 : 1) * inner, y: v.y };
    const ymax = mode === 'fringe' ? yF : Math.min(yF, hl.yAt(v.x) + 0.01 * H);
    return v.y > ymax ? { x: v.x, y: ymax } : v;
  };
  const inZone = (v: Vec, mode: GuardMode): boolean => {
    const inner = hw(v.y) - sideMargin(v.y);
    if (Math.abs(v.x) >= inner) return false;
    return v.y > (mode === 'fringe' ? yF : Math.min(yF, hl.yAt(v.x) + 0.01 * H));
  };
  const fit = (poly: Vec[], mode: GuardMode = 'cap'): Vec[] => {
    const P = poly.map((v) => project(v, mode));
    const out: Vec[] = [];
    const split = (a: Vec, b: Vec, depth: number): void => {
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (depth >= 5 || !inZone(m, mode)) return;
      const pm = project(m, mode);
      split(a, pm, depth + 1);
      out.push(pm);
      split(pm, b, depth + 1);
    };
    P.forEach((a, i) => {
      out.push(a);
      split(a, P[(i + 1) % P.length] as Vec, 0);
    });
    return out;
  };
  return { project, fit, yF, sideMargin, hw };
}
