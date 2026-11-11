import { browGeometry, effectivePupilSize, isLegacyPupil, openingGeometry, openingPolygon, pupilContours } from '../geometry/eye';
import { toHostFrame, type PlacedEye } from '../anatomy/relations';
import { irisCenter, irisRadii, pupilRadii } from './eye/helpers';
import { resolveEye } from './eye/eye';
import { dominantColor } from '../materials';
import { sideOf } from '../anatomy/orbit';
import { fx, fy } from '../head-turntable/engines/units';
import type { HostBrow, HostEye, HostEyes } from '../head-turntable';

const N = 24;
const ellipse = (r: { rx: number; ry: number }): { x: number; y: number }[] => Array.from({ length: 32 }, (_, i) => ({ x: r.rx * Math.cos((i / 32) * 2 * Math.PI), y: r.ry * Math.sin((i / 32) * 2 * Math.PI) }));

/**
 * Yeux POSÉS de l'hôte → yeux de la tête 3D (U, repère de la tête, x = |x|). Source unique : les yeux du graphe de scène eux-mêmes (forme d'ouverture, taille, iris, pupille, regard),
 * ramenés dans le repère de l'hôte par la transformation que le rendu de face applique (`toHostFrame`), puis à l'échelle de la tête (1 U = hauteur du visage, comme `from-host`).
 * Retourne `undefined` s'il manque un côté : la tête garde alors les yeux de la planche (aucune invention d'un œil absent).
 */
export function hostEyesU(eyes: readonly PlacedEye[], faceH: number): HostEyes | undefined {
  const by: Partial<Record<'left' | 'right', HostEye>> = {};
  const k = 1000 / faceH, X = (v: number): number => Math.abs(fx(v * k)), Y = (v: number): number => fy(v * k);
  for (const placed of eyes) {
    // Œil EFFECTIF (archétype, expression, réponse lumineuse, étalonnage) : exactement ce que le rendu de face dessine, pas la spec brute.
    const pe: PlacedEye = { ...placed, eye: resolveEye(placed.eye) }, side = sideOf(pe);
    if (by[side]) continue;
    const g = openingGeometry(pe.eye.shape, pe.eye.canthi), poly = openingPolygon(g, N).map((q) => toHostFrame(q, pe));
    const pt = (q: { x: number; y: number }): { x: number; y: number } => ({ x: X(q.x), y: Y(q.y) });
    const upper = [...poly.slice(0, N), poly[N]!].map(pt), lower = [...poly.slice(N), poly[0]!].reverse().map(pt);
    const c = toHostFrame(irisCenter(pe.eye, g), pe), s = (pe.world.scale / pe.host.scale) * k / 1000, ir = irisRadii(pe.eye), pu = pe.eye.pupil;
    // Pupille : mêmes contours que le rendu de face (`pupilContours`, taille effective), tournés comme l'œil par rapport à l'hôte, en U, relatifs à l'iris ; côté gauche miroité (x = |x|).
    const rot = ((pe.world.rotationDeg - pe.host.rotationDeg) * Math.PI) / 180, mx = c.x < 0 ? -1 : 1, size = pu.response.model === 'fixed' ? pu.size : effectivePupilSize(pu);
    const raw = !pu.visible ? [] : isLegacyPupil(pu) ? [ellipse(pupilRadii(pe.eye, ir.rx, ir.ry))] : [...pupilContours(pu, size, ir.rx, ir.ry, pe.eye.seed).contours];
    const contours = raw.map((ct) => ct.map((q) => ({ x: mx * s * (q.x * Math.cos(rot) - q.y * Math.sin(rot)), y: s * (q.x * Math.sin(rot) + q.y * Math.cos(rot)) })));
    // Sourcil : MÊME géométrie que le dessin de face (`browGeometry`, pli de paupière compris), contour et ligne médiane ramenés dans le repère de l'hôte puis en U ; absent si l'œil n'a pas de sourcil.
    const eb = pe.eye.eyebrow, bg = eb ? browGeometry(g, eb, pe.eye.lids.crease.height) : null;
    const brow: HostBrow | undefined = eb && bg ? { outline: bg.outline.map((q) => pt(toHostFrame(q, pe))), line: bg.center.map((q) => pt(toHostFrame(q, pe))), widths: bg.widths.map((wd) => wd * s), color: dominantColor(eb.material.base) } : undefined;
    by[side] = { upper, lower, iris: { cx: X(c.x), cy: Y(c.y), rx: ir.rx * s, ry: ir.ry * s }, pupil: { contours, color: dominantColor(pu.fill) }, ...(brow ? { brow } : {}) };
  }
  return by.left && by.right ? { left: by.left, right: by.right } : undefined;
}
