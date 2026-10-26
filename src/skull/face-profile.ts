import type { FaceParams } from '../schema';
import type { Frame } from './frame';
import type { CPoint, SkullParams } from './types';

/**
 * PROFIL DE LA FACE (peau), du glabelle au menton : nez (racine, dorsum droit / concave / convexe, rupture supra-pointe, pointe, columelle, sous-nasal),
 * philtrum, lèvres (vermillon, labrale, stomion), sillon mentolabial, pogonion, bas du menton. Tous les x viennent de `Frame` (ligne E respectée),
 * tous les y des repères du visage de face. L'acuité `s` marque les angles vifs (racine du nez, sous-nasal, stomion, sillon).
 */
export function facePoints(face: FaceParams, sk: SkullParams, fr: Frame): CPoint[] {
  const { H, f, x } = fr;
  const y = (k: keyof Frame['f']): number => f[k] * H;
  const N = { x: x.nasion, y: y('nasion') };
  const tipY = y('tip');
  const rt = face.nose.tip.roundness;
  const S = { x: x.tip - (0.022 + 0.008 * rt) * H, y: tipY - 0.02 * H };
  const dx = S.x - N.x, dy = S.y - N.y;
  const len = Math.hypot(dx, dy) || 1;
  const nrm = { x: dy / len, y: -dx / len };
  const shape = face.nose.dorsum.shape;
  const c = face.nose.dorsum.curvature;
  // Écart du dorsum à la corde nasion → supra-pointe (px) : concave = creux, convexe = bosse ; sin(πt) s'annule aux deux bouts (raccord garanti).
  const off = (t: number): number => (shape === 'concave' ? -0.014 * H * c : shape === 'convex' ? 0.018 * H * c * (1 + 0.4 * Math.sin(Math.PI * t * 0.8)) : 0) * Math.sin(Math.PI * t);
  const dorsum = (t: number, id?: string): CPoint => ({ x: N.x + dx * t + nrm.x * off(t), y: N.y + dy * t + nrm.y * off(t), ...(id ? { id } : {}) });
  const rot = face.nose.tip.rotation;
  const tipFront: CPoint = { x: x.tip - 0.004 * H, y: tipY + (0.012 + 0.006 * rt) * H };
  const tipUnder: CPoint = { x: x.tip - (0.02 + 0.012 * rt) * H, y: tipY + (0.026 + 0.01 * rt - 0.012 * rot) * H };
  const sub: CPoint = { x: x.sub, y: y('sub'), s: 0.55, id: 'subnasale' };
  const col: CPoint = { x: (tipUnder.x + sub.x) / 2 + 0.006 * H, y: (tipUnder.y + sub.y) / 2 };
  const lipTopY = y('lsTop');
  return [
    { x: x.glabella + 0.008 * H * sk.browRidge, y: y('glabella'), id: 'glabella' },
    { x: N.x, y: N.y, s: 0.2, id: 'nasion' },
    dorsum(0.22, 'rhinion'), dorsum(0.5), dorsum(0.78),
    { ...S, id: 'supratip' },
    { x: x.tip, y: tipY, id: 'pronasale' },
    tipFront, tipUnder, col, sub,
    { x: x.sub + 0.35 * (x.ls - x.sub) - 0.003 * H, y: sub.y + 0.45 * (lipTopY - sub.y), id: 'philtrum' },
    { x: x.ls - 0.007 * H, y: lipTopY, s: 0.3, id: 'vermilionSup' },
    { x: x.ls, y: y('ls'), id: 'labraleSup' },
    { x: x.stomion, y: y('stomion'), s: 0.75, id: 'stomion' },
    { x: x.li, y: y('li'), id: 'labraleInf' },
    { x: x.li - 0.008 * H, y: y('liBot'), s: 0.2, id: 'vermilionInf' },
    { x: x.sulcus, y: y('sulcus'), s: 0.3, id: 'sublabiale' },
    { x: x.pogonion, y: y('pogonion'), id: 'pogonion' },
    { x: x.pogonion - 0.012 * H, y: y('pogonion') + 0.62 * (H - y('pogonion')) },
    { x: x.menton, y: H, id: 'menton' },
  ];
}
