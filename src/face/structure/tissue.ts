import { catmullRom } from '../curve';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt } from '../outline';
import type { NoseGeometry } from '../nose';
import type { Derived } from './dependencies';
import type { Blob, CheekGeo, TissueGeo } from './types';

const blob = (cx: number, cy: number, rx: number, ry: number, rotDeg = 0): Blob => ({ c: { x: cx, y: cy }, rx, ry, rotDeg });

/**
 * Tissus mous et joues (T6, T8) : ce qui donne l'impression de chair. Toutes les positions sont dérivées du contour (`halfWidthAt`) et des repères :
 * si la mâchoire s'élargit, les joues suivent. Chaque ellipse est un VOLUME (pommette, chair, creux, transition) que le rendu éclaire — pas une ligne collée.
 */
export function tissueGeometry(p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, d: Derived): TissueGeo {
  const { W, H } = lm;
  const c = p.cheek;
  const hw = (y: number): number => halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-H / 2, y)));
  const yz = lm.eyeY + 0.07 * H; // niveau de la pommette
  const yc = (lm.eyeY + lm.mouthY) / 2 + 0.01 * H; // niveau du milieu de la joue
  const yh = yz + 0.075 * H; // niveau du creux sous la pommette
  const g = lm.jaw.gonion;
  const cheek = (s: -1 | 1): CheekGeo => {
    const wz = hw(yz);
    return {
      side: s,
      // Pommette : plus large et plus haute avec `boneProjection`, étalée latéralement par `lateralWidth`.
      zygoma: blob(s * wz * 0.62 * (0.9 + 0.2 * c.lateralWidth), yz, (0.06 + 0.03 * c.boneProjection) * W, 0.035 * H, -s * 12),
      // Chair : volume de la joue, de la paroi du nez au contour.
      volume: blob(s * hw(yc) * 0.58, yc, hw(yc) * 0.38 * (0.9 + 0.3 * c.volume), 0.07 * H * (0.8 + 0.4 * c.volume)),
      // Creux sous la pommette : fosse infra-zygomatique.
      hollow: blob(s * hw(yh) * 0.64, yh, 0.05 * W * (0.5 + c.hollow), 0.03 * H * (0.6 + c.hollow), -s * 8),
      // Transition creux → masséter : entre le creux et l'angle de mâchoire.
      masseterBlend: blob(s * hw((yh + g.y) / 2) * 0.76, (yh + g.y) / 2, 0.035 * W * (0.6 + 0.8 * c.masseterBlend), Math.max(0.01 * H, (g.y - yh) * 0.3), s * 6),
      lateralWidthPx: Math.max(0, wz * (0.5 + 0.5 * c.lateralWidth) - nose.widthPx / 2),
    };
  };
  const l = lm.lips;
  const per = p.softTissue.perioral;
  const half = lm.outline.chinHalf;
  // Pli péri-buccal : de la commissure vers le bas du menton (pli « de marionnette ») ; pli nasogénien : celui du nez (même courbe que `nose.junctions`).
  const marion = (s: -1 | 1): ReturnType<typeof catmullRom> => catmullRom([{ x: s * l.half * 1.02, y: l.cornerY + 0.005 * H }, { x: s * l.half * 1.1, y: (l.cornerY + lm.chin.sulcusY) / 2 }, { x: s * half * 1.15, y: lm.chin.sulcusY + 0.3 * lm.chin.heightPx }], false, 6);
  const sub = (0.01 + 0.04 * (0.6 * p.jaw.submental + 0.8 * p.neck.thickness)) * H;
  return {
    cheeks: { left: cheek(-1), right: cheek(1) },
    perioral: {
      upper: blob(0, (lm.noseBaseY + l.topY) / 2, l.half * (0.5 + 0.4 * per), Math.max(0.006 * H, (l.topY - lm.noseBaseY) * 0.4)),
      lower: blob(0, (l.bottomY + lm.chin.sulcusY) / 2, l.half * (0.4 + 0.4 * per), Math.max(0.005 * H, (lm.chin.sulcusY - l.bottomY) * 0.5)),
      left: blob(-(l.half + 0.018 * W), l.cornerY, 0.03 * W * (0.6 + per), 0.03 * H),
      right: blob(l.half + 0.018 * W, l.cornerY, 0.03 * W * (0.6 + per), 0.03 * H),
    },
    submental: { thicknessPx: sub, blob: blob(0, lm.chinY + 0.5 * Math.max(sub, d.submentalReachPx * 0.5), half * 1.3, Math.max(0.004 * H, sub)) },
    folds: { nasolabial: { left: nose.junctions.nasolabial.left, right: nose.junctions.nasolabial.right }, perioral: { left: marion(-1), right: marion(1) } },
  };
}
