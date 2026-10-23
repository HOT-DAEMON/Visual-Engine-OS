import { el, num } from '../../../core/svg';
import type { Vec } from '../../../geometry/eye/primitives';
import type { EarGeo } from '../../../face';
import type { FaceLandmarks } from '../../../face';
import { projectPoint } from '../../../face/ear/project';
import type { FaceParams } from '../../../schema';

/** Bijou posé : point d'attache projeté, extrémité pendante, rayon, état (compatibilité, collision avec le cou). */
export interface PlacedJewel {
  readonly kind: string;
  readonly at: Vec;
  readonly end: Vec;
  readonly r: number;
  readonly compatible: boolean;
  readonly collidesNeck: boolean;
  readonly markup: string;
}

/**
 * BIJOUX (§6.3) : chaque piercing se pose sur un POINT D'ATTACHE du modèle (`PiercingAnchor`, repère du plan) donc suit l'oreille quand son angle,
 * son échelle ou sa forme changent. Le bijou pend sous la gravité (l'extrémité descend en y de l'écran) ; il est refusé (`compatible`) si la structure
 * d'accueil n'existe pas, et signale une collision avec le cou si son extrémité entre dans la bande du cou.
 */
export function earJewelry(p: FaceParams, lm: FaceLandmarks, e: EarGeo, yawDeg = 0): PlacedJewel[] {
  if (!e.model || !e.placement || p.ears.piercings.length === 0) return [];
  const T = e.model.thickness * e.placement.hPx;
  const pivot = e.model.landmarks.crus as Vec;
  const out: PlacedJewel[] = [];
  for (const pc of p.ears.piercings) {
    const a = e.model.anchors.find((x) => x.kind === pc.kind);
    if (!a || !a.compatible) { if (a) out.push({ kind: pc.kind, at: { x: 0, y: 0 }, end: { x: 0, y: 0 }, r: 0, compatible: false, collidesNeck: false, markup: '' }); continue; }
    const at = projectPoint(e.placement, a.at, 0.9 * T, yawDeg, pivot);
    const r = pc.size * e.placement.hPx * 0.5;
    const drop = pc.jewel === 'drop' || pc.jewel === 'chain' ? pc.hang * pc.size * e.placement.hPx * 4 : pc.jewel === 'ring' ? r * 1.6 : 0;
    const end = { x: at.x, y: at.y + drop };
    const collides = Math.abs(end.x) < lm.neck.half && end.y > lm.jaw.gonion.y;
    const metal = pc.color;
    const ball = (c: Vec, rr: number): string => el('circle', { cx: num(c.x), cy: num(c.y), r: num(rr), fill: metal, stroke: '#00000055', 'stroke-width': num(rr * 0.12) }) + el('circle', { cx: num(c.x - rr * 0.3), cy: num(c.y - rr * 0.3), r: num(rr * 0.28), fill: '#ffffff', opacity: 0.7 });
    let markup = '';
    if (pc.jewel === 'stud') markup = ball(at, r * 0.6);
    else if (pc.jewel === 'ring') markup = el('ellipse', { cx: num(at.x), cy: num(at.y + r * 0.8), rx: num(r * 0.8), ry: num(r * 1.1), fill: 'none', stroke: metal, 'stroke-width': num(r * 0.22) });
    else markup = el('path', { d: `M${num(at.x)} ${num(at.y)}L${num(end.x)} ${num(end.y)}`, stroke: metal, 'stroke-width': num(r * 0.12), fill: 'none' }) + ball(at, r * 0.35) + ball(end, r * (pc.jewel === 'drop' ? 0.7 : 0.45));
    out.push({ kind: pc.kind, at, end, r, compatible: true, collidesNeck: collides, markup });
  }
  return out;
}
