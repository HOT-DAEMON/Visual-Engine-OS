import type { FaceParams } from '../../schema';
import type { EarGeo } from '../ears-geometry';
import { hairGeometry } from '../hair';
import { coverageOf } from '../hair/sides';
import type { FaceLandmarks } from '../landmarks';

/** États de visibilité d'une oreille (§6.2). La GÉOMÉTRIE de l'oreille n'est jamais supprimée : seule sa visibilité change. */
export type EarVisibility = 'visible' | 'partial' | 'under_hair' | 'strand_behind' | 'tucked_behind' | 'covers_piercing';

export interface EarVisibilityInfo {
  readonly state: EarVisibility;
  /** Part de la silhouette de l'oreille couverte par les mèches de devant (0–1). */
  readonly covered: number;
  /** Les mèches passent-elles DERRIÈRE le pavillon (rangées, tresses) ? */
  readonly behind: boolean;
  /** Piercings dont le point d'attache (projeté de face) est couvert par les cheveux. */
  readonly hiddenPiercings: number;
}

/**
 * Visibilité de l'oreille sous les cheveux : mesurée sur les mèches du plan avant (`hairGeometry`), pas supposée. `strand_behind` / `tucked_behind` :
 * le comportement de la coiffure sur ce côté est « rangé » ; `covers_piercing` : l'oreille est visible mais un bijou est recouvert.
 */
export function earVisibility(p: FaceParams, lm: FaceLandmarks, ear: EarGeo): EarVisibilityInfo {
  const hair = hairGeometry(p, lm);
  if (!hair) return { state: 'visible', covered: 0, behind: false, hiddenPiercings: 0 };
  const front = hair.locks.filter((l) => l.layer === 'front').map((l) => l.poly);
  const covered = coverageOf(front, ear.poly);
  const info = ear.side < 0 ? hair.sides.left : hair.sides.right;
  const behind = info.ear === 'tucked';
  const hidden = ear.model ? ear.model.anchors.filter((a) => a.compatible && p.ears.piercings.some((x) => x.kind === a.kind)).filter(() => covered > 0.3).length : 0;
  const state: EarVisibility = behind ? 'tucked_behind' : covered >= 0.6 ? 'under_hair' : covered >= 0.08 ? (hidden > 0 ? 'covers_piercing' : 'partial') : 'visible';
  return { state, covered, behind, hiddenPiercings: hidden };
}
