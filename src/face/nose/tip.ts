import { superEllipse } from '../curve';
import type { FaceParams } from '../../schema';
import type { NoseFrame } from './frame';
import type { NoseTipGeo } from './types';

/**
 * Pointe du nez (lobule). Largeur, rondeur et orientation viennent du cadre ; la pointe est une super-ellipse dont l'exposant monte
 * avec la rondeur (1,5 = pointue en losange arrondi … 2,5 = bulbeuse). Une déviation du dorsum décale la pointe d'un tiers de son
 * amplitude : la pointe suit l'arête, elle ne reste pas plantée sur la ligne médiane pendant que l'arête dévie.
 */
export function tipGeometry(p: FaceParams, F: NoseFrame, deviationPx: number, projectionPx: number): NoseTipGeo {
  const x = 0.3 * deviationPx;
  const e = 1.5 + p.nose.tip.roundness;
  return { c: { x, y: F.tipY }, rx: F.tipHalf, ry: F.tipRy, poly: superEllipse(x, F.tipY, F.tipHalf, F.tipRy, e, 32), projectionPx };
}
