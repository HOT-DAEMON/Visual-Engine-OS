import type { SkinRegionId } from '../schema';
import { halfWidthAt } from './outline';
import type { FaceLandmarks } from './landmarks';
import type { NoseGeometry } from './nose';

/** Ellipse de région (repère de l'hôte, px). */
export interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** Régions de la peau (une ou deux ellipses chacune) + `shoulders` (épaules, hors matériau de peau : zone lumineuse seulement). */
export type SkinRegions = Readonly<Record<SkinRegionId | 'shoulders', readonly Ellipse[]>>;

/**
 * Découpe du visage en RÉGIONS NOMMÉES (front, nez, joues, tempes, menton, lèvre supérieure, cou, épaules). C'est le seul pont entre
 * la GÉOMÉTRIE et le MATÉRIAU de peau : le matériau parle de régions par leur nom (`roughness.cheeks`), la géométrie dit où elles sont.
 * Les positions viennent des repères et du nez ; la remontée des joues à l'ouverture de la bouche (tissus) est prise en compte.
 */
export function skinRegions(lm: FaceLandmarks, nose: NoseGeometry): SkinRegions {
  const { W, H } = lm;
  const hw = (y: number): number => halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-H / 2, y)));
  // Front : du haut du crâne (0,14 H sous le sommet) à la limite des sourcils.
  const f0 = -H / 2 + 0.14 * H;
  const fy = (f0 + lm.browLimitY) / 2;
  const forehead: Ellipse = { cx: 0, cy: fy, rx: Math.min(0.3 * W, 0.8 * hw(fy)), ry: Math.max(0.04 * H, (lm.browLimitY - f0) / 2) };
  const noseE: Ellipse = { cx: 0, cy: (nose.root.y + nose.tip.c.y) / 2, rx: nose.widthPx * 0.3, ry: Math.max(0.02 * H, (nose.tip.c.y - nose.root.y) / 2) };
  const cheekY = (lm.eyeY + lm.mouthY) / 2 + 0.01 * H - lm.jaw.tissue.cheekLift;
  const inner = (nose.widthPx / 2) * 1.1;
  const cheek = (s: -1 | 1): Ellipse => ({ cx: s * (inner + (hw(cheekY) - inner) * 0.5), cy: cheekY, rx: Math.max(0.01 * W, (hw(cheekY) - inner) * 0.42), ry: 0.075 * H });
  const templeY = lm.eyeY - 0.09 * H;
  const temple = (s: -1 | 1): Ellipse => ({ cx: s * hw(templeY) * 0.74, cy: templeY, rx: 0.075 * W, ry: 0.075 * H });
  const chin: Ellipse = { cx: 0, cy: (lm.chin.sulcusY + lm.chinY) / 2, rx: lm.chin.half * 0.9, ry: Math.max(0.02 * H, lm.chin.heightPx / 2) };
  const lipY = (lm.noseBaseY + lm.lips.topY) / 2;
  const upperLip: Ellipse = { cx: 0, cy: lipY, rx: 0.05 * W, ry: Math.max(0.008 * H, (lm.lips.topY - lm.noseBaseY) / 2) };
  const neck: Ellipse = { cx: 0, cy: (lm.chinY + lm.neck.bottomY) / 2, rx: lm.neck.half, ry: Math.max(0.02 * H, (lm.neck.bottomY - lm.chinY) / 2) };
  const sh = (s: -1 | 1): Ellipse => ({ cx: s * lm.neck.half * 1.1, cy: lm.neck.bottomY - 0.02 * H, rx: lm.neck.half * 0.9, ry: 0.03 * H });
  return { forehead: [forehead], nose: [noseE], cheeks: [cheek(-1), cheek(1)], temples: [temple(-1), temple(1)], chin: [chin], upperLip: [upperLip], neck: [neck], shoulders: [sh(-1), sh(1)] };
}
