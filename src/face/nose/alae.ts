import { catmullRom, mirrorPoly } from '../curve';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { NoseFrame } from './frame';
import type { NoseAlaGeo } from './types';

/**
 * Ailes du nez. Une aile est un VOLUME fermé : elle part de la pointe (jonction aile-lobule), contourne la crête alaire (le point le plus
 * saillant, `alarX`), descend jusqu'à l'attache sur la joue (sillon alaire) et revient le long du seuil de la narine vers la columelle.
 * L'épaisseur du bord et le volume sont des propriétés de rendu lues ici (`thicknessPx`) ; la forme, elle, ne dépend que du cadre.
 * Les points sont construits pour le côté DROIT et reflétés pour le gauche.
 */
export function alaGeometry(p: FaceParams, F: NoseFrame, tipX: number): { left: NoseAlaGeo; right: NoseAlaGeo } {
  const a = p.nose.alae;
  const span = F.baseY - F.tipY;
  const H = F.H;
  // Attache sur la joue : l'aile descend un peu sous la base du nez (0,004 H), plus quand `attachment` est faible (sillon plus profond).
  const foot = F.baseY + (0.004 + 0.004 * (1 - a.attachment)) * H;
  const ctrl: Vec[] = [
    { x: tipX + F.tipHalf * 0.92, y: F.tipY + 0.004 * H },
    { x: F.alarX * 0.86, y: F.tipY + 0.2 * span },
    { x: F.alarX, y: F.tipY + 0.55 * span },
    { x: F.alarX * 0.84, y: foot },
    { x: F.colHalf * 1.15 + F.nw * 0.04, y: foot + 0.002 * H },
    { x: F.colHalf * 1.25, y: F.tipY + 0.55 * span },
  ];
  const right = catmullRom(ctrl, true, 6);
  const thick = F.nw * (0.03 + 0.05 * a.thickness);
  const make = (side: -1 | 1, poly: Vec[]): NoseAlaGeo => ({ side, poly, crest: { x: side * (ctrl[1] as Vec).x, y: (ctrl[1] as Vec).y }, outerX: F.alarX, base: { x: side * (ctrl[3] as Vec).x, y: foot }, thicknessPx: thick });
  return { right: make(1, right), left: make(-1, mirrorPoly(right)) };
}
