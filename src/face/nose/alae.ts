import { catmullRom, mirrorPoly } from '../curve';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { NoseFrame } from './frame';
import { baseHalfAt } from './constraints';
import type { NoseAlaGeo } from './types';

/**
 * Ailes du nez. Une aile est un VOLUME fermé : elle part de la pointe (jonction aile-lobule), contourne la crête alaire (le point le plus
 * saillant, `alarX`), descend jusqu'à l'attache sur la joue (sillon alaire) et revient le long du seuil de la narine vers la columelle.
 * L'épaisseur du bord et le volume sont des propriétés de rendu lues ici (`thicknessPx`) ; la forme, elle, ne dépend que du cadre.
 * Les points sont construits pour le côté DROIT et reflétés pour le gauche.
 */
export function alaGeometry(p: FaceParams, F: NoseFrame, tipX: number, baseWidth = 0): { left: NoseAlaGeo; right: NoseAlaGeo } {
  const a = p.nose.alae;
  const span = F.baseY - F.tipY;
  const H = F.H;
  // Attache sur la joue : l'aile descend un peu sous la base du nez (0,004 H), plus quand `attachment` est faible (sillon plus profond).
  const foot = F.baseY + (0.004 + 0.004 * (1 - a.attachment)) * H;
  // Aile : un coin qui remonte le long de la paroi du nez (jonction haute près de la pointe), s'élargit en crête, redescend vers l'attache sur la joue
  // puis revient le long du seuil de la narine. Six points de contrôle, courbe de Catmull-Rom fermée.
  const ctrl: Vec[] = [
    { x: tipX + F.tipHalf * 1.05, y: F.tipY - 0.9 * F.tipRy },
    { x: F.alarX * 0.78, y: F.tipY - 0.15 * F.tipRy },
    { x: F.alarX, y: F.tipY + 0.4 * span },
    // Pied de l'aile : sa position latérale est la LARGEUR DE BASE (axe `nose.base.width`, indépendant de l'écartement de la crête `alae.flare`). Neutre : 0,8 × la crête.
    { x: baseHalfAt(F, baseWidth), y: foot },
    { x: F.colHalf + F.nw * 0.02, y: foot + 0.002 * H },
    { x: F.colHalf + F.nw * 0.02, y: F.tipY + 0.35 * span },
  ];
  const right = catmullRom(ctrl, true, 6);
  // Le polygone commence à la jonction avec la pointe (ctrl[0]) : les 3 premiers segments (3 × 6 sous-points + 1) forment le bord extérieur.
  const edge = right.slice(0, 3 * 6 + 1);
  const thick = F.nw * (0.03 + 0.05 * a.thickness);
  const make = (side: -1 | 1, poly: Vec[]): NoseAlaGeo => ({ side, poly, outerEdge: edge.map((q) => ({ x: side * q.x, y: q.y })), crest: { x: side * (ctrl[2] as Vec).x, y: (ctrl[2] as Vec).y }, outerX: F.alarX, base: { x: side * (ctrl[3] as Vec).x, y: foot }, thicknessPx: thick });
  return { right: make(1, right), left: make(-1, mirrorPoly(right)) };
}
