import { clamp } from '../../../core/math';
import type { FaceParams } from '../../../schema';
import type { FaceLandmarks } from '../../landmarks';
import { halfWidthAt } from '../../outline';
import type { SideburnProfile } from './types';

/**
 * Bande des pattes (favoris) : marge entre le contour et le bord avant de la patte. Elle part du point de tempe (`hair.templeY`, marge
 * `w0` = 3 % de la demi-largeur) et s'élargit jusqu'à la pointe (`wSB`), située au plus à 0,03 H au-dessus de la ligne des yeux.
 * SOURCE UNIQUE : le garde-fou des mèches (`guard.ts`), la lisière et la vérification lisent cette même fonction.
 */
export function sideburnProfile(p: FaceParams, lm: FaceLandmarks): SideburnProfile {
  const { W, H } = lm;
  const sb = p.hair.sideburns;
  const yT = lm.hair.templeY;
  const yTip = Math.max(yT + 0.02 * H, Math.min(yT + (0.1 + 0.9 * sb) * (lm.eyeY - yT) * 0.8, lm.eyeY - 0.03 * H));
  const w0 = 0.03 * halfWidthAt(lm.outline, yT);
  const wTip = (0.022 + 0.018 * sb) * W;
  return { yT, yTip, margin: (y) => (y <= yTip + 1e-9 ? w0 + (wTip - w0) * clamp((y - yT) / (yTip - yT), 0, 1) : 0) };
}
