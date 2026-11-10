import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt, rightSamples } from '../outline';
import { sideburnProfile } from './boundary/sideburn';
import type { Hairline } from './hairline';

export type GuardMode = 'cap' | 'fringe' | 'cheek';

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
  /**
   * Ligne médiane COUPÉE à l'entrée de la zone interdite (`docs/HAIR-EDGE.md`) : la mèche s'arrête au bord de la zone au lieu d'y être écrasée sommet par sommet
   * (`fit` aplatit un ruban large en coin à bords droits collé sur l'implantation : les « grands triangles sombres » du dessus des cheveux longs). Le dernier point
   * est trouvé par bissection entre le dernier point libre et le premier point interdit. Identité si la ligne ne traverse pas la zone ; `null` si moins de 3 points restent.
   */
  clip(spine: Vec[], mode?: GuardMode): Vec[] | null;
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
  const profile = sideburnProfile(p, lm);
  const yF = lm.browLimitY - 0.008 * H;
  const sideMargin = profile.margin;
  // Mode `cheek` : une mèche peut longer la joue DEVANT l'oreille. Marge bornée par la marge de l'œil au niveau des yeux
  // (le bord extérieur d'un œil reste à 0,045 W du contour : `fit-eye.ts`), plus large sous le nez où il n'y a que la joue.
  const cheekMargin = (y: number): number => {
    const dEye = y - lm.eyeY;
    if (dEye < -0.1 * H) return 0.04 * W;
    if (dEye < 0.1 * H) return 0.03 * W;
    return 0.03 * W + 0.055 * W * clamp((dEye - 0.1 * H) / (0.14 * H), 0, 1) * clamp((lm.jawY + 0.04 * H - y) / (0.1 * H), 0, 1);
  };
  const margin = (y: number, mode: GuardMode): number => (mode === 'cheek' ? Math.max(sideMargin(y), cheekMargin(y)) : sideMargin(y));
  const project = (v: Vec, mode: GuardMode = 'cap'): Vec => {
    const inner = hw(v.y) - margin(v.y, mode);
    if (Math.abs(v.x) >= inner) return v;
    // Frange : une pointe qui dépasse la limite des sourcils y est RAMENÉE (jamais poussée de côté : cela traçait une arête qui traversait le front).
    if (v.y > yF) return mode === 'fringe' ? { x: v.x, y: yF } : { x: (v.x < 0 ? -1 : 1) * inner, y: v.y };
    const ymax = mode === 'fringe' ? yF : Math.min(yF, hl.yAt(v.x) + 0.01 * H);
    return v.y > ymax ? { x: v.x, y: ymax } : v;
  };
  const inZone = (v: Vec, mode: GuardMode): boolean => {
    const inner = hw(v.y) - margin(v.y, mode);
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
  const clip = (c: Vec[], mode: GuardMode = 'cap'): Vec[] | null => {
    if (mode === 'fringe') return c;
    let k = -1;
    for (let i = 1; i < c.length; i++) if (inZone(c[i] as Vec, mode)) { k = i; break; }
    if (k < 0) return c;
    const a = c[k - 1] as Vec, b = c[k] as Vec;
    let lo = 0, hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (inZone({ x: a.x + (b.x - a.x) * mid, y: a.y + (b.y - a.y) * mid }, mode)) hi = mid;
      else lo = mid;
    }
    const out = [...c.slice(0, k), { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo }];
    return out.length >= 3 ? out : null;
  };
  return { project, fit, clip, yF, sideMargin, hw };
}
