import { cubicAt, type Cubic, type Vec } from '../../geometry/eye/primitives';
import { halfWidthAt, type Outline } from '../outline';
import type { FaceLandmarks } from '../landmarks';
import type { PosedFace } from './index';

/**
 * SILHOUETTE DU CRÂNE EN LACET (`docs/ROTATION-STEP-02-SVG-SILHOUETTE.md`) : le contour frontal (`lm.outline`, source unique du dessin de la tête) est conservé tel quel et seule sa demi-largeur est
 * recalculée par la pose commune : à chaque ordonnée y, le point x du contour est multiplié par `posed.skullHalf(y) / halfWidthAt(lm.outline, y)`, c'est-à-dire par le raccourcissement que la pose
 * (`Skull.halfAt` : ellipsoïde du crâne, cône de la mâchoire) donne à cette hauteur. À lacet nul le facteur vaut 1 : le contour rendu est l'objet `lm.outline` lui-même (identité, pas un recalcul).
 *
 * Les points du contour sont mis à l'échelle à LEUR ordonnée (les extrémités communes de deux morceaux reçoivent le même facteur : le contour reste fermé et continu) ; les ordonnées ne changent pas
 * (rotation autour de l'axe vertical). Le facteur est évalué dans `[haut + 2 % H, bas du menton − 2 % H]` : aux deux pointes la demi-largeur est nulle et le rapport n'est pas défini.
 *
 * LIMITE (documentée, non contournée) : `Skull` décrit un ellipsoïde centré sur l'axe du cou ; la silhouette est donc symétrique (lacet +θ et −θ donnent deux contours identiques). L'asymétrie réelle
 * (menton et face qui avancent du côté de la rotation, occiput qui recule de l'autre) n'est pas dans les données de `posedFace()` : elle n'est pas inventée ici.
 */
/** Morceaux de Hermite par cubique d'origine. */
const PIECES = 6;

export function posedOutline(lm: FaceLandmarks, posed: PosedFace): Outline {
  if (posed.yaw === 0) return lm.outline;
  const o = lm.outline, margin = 0.02 * o.H, yLo = -o.H / 2 + margin, yHi = lm.chinY - margin;
  const scale = (y: number): number => {
    const ye = Math.min(yHi, Math.max(yLo, y)), hx = halfWidthAt(o, ye);
    return hx > 1e-6 ? posed.skullHalf(ye) / hx : 1;
  };
  const ds = 0.25;   // pas (px) de la dérivée numérique du facteur
  const pt = (q: Vec): Vec => ({ x: q.x * scale(q.y), y: q.y });
  // Chaque cubique est découpée en `PIECES` morceaux ; chaque morceau est la cubique de Hermite qui passe par les points MIS À L'ÉCHELLE de ses deux bouts avec la tangente EXACTE de la courbe mise à l'échelle
  // (x'·s + x·s'·y', y'). L'erreur ne dépend plus de la courbure du contour (mise à l'échelle des seuls points de contrôle : 6 % d'erreur au coin de mâchoire) et la tangente est continue aux raccords.
  const at = (c: Cubic, t: number): Vec => cubicAt(c.p0, c.p1, c.p2, c.p3, t);
  const der = (c: Cubic, t: number): Vec => {
    const u = 1 - t;
    return { x: 3 * (u * u * (c.p1.x - c.p0.x) + 2 * u * t * (c.p2.x - c.p1.x) + t * t * (c.p3.x - c.p2.x)), y: 3 * (u * u * (c.p1.y - c.p0.y) + 2 * u * t * (c.p2.y - c.p1.y) + t * t * (c.p3.y - c.p2.y)) };
  };
  const tangent = (c: Cubic, t: number): Vec => {
    const q = at(c, t), d = der(c, t), sy = (scale(q.y + ds) - scale(q.y - ds)) / (2 * ds);
    return { x: d.x * scale(q.y) + q.x * sy * d.y, y: d.y };
  };
  const seg = (c: Cubic): Cubic[] => Array.from({ length: PIECES }, (_, k) => {
    const t0 = k / PIECES, t1 = (k + 1) / PIECES, h = (t1 - t0) / 3, P0 = pt(at(c, t0)), P3 = pt(at(c, t1)), T0 = tangent(c, t0), T1 = tangent(c, t1);
    return { p0: P0, p1: { x: P0.x + T0.x * h, y: P0.y + T0.y * h }, p2: { x: P3.x - T1.x * h, y: P3.y - T1.y * h }, p3: P3 };
  });
  const keys = o.keys;
  return { ...o, right: o.right.flatMap(seg), chinHalf: o.chinHalf * scale(lm.chinY), keys: { gonion: pt(keys.gonion), chinCorner: pt(keys.chinCorner), bottom: pt(keys.bottom) } };
}
