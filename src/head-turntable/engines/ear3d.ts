import { earPlacement } from '../../face/ear/place';
import { earModel } from '../../face/ear/geometry';
import { placeEarPoint, type EarPlacement } from '../../face/ear/project';
import type { EarModel } from '../../face/ear/types';
import { rad, v3 } from '../math';
import { gridMesh, PART, type Mesh } from '../mesh';
import { sectionAt } from '../sections';
import type { HeadTurnSpec, V3 } from '../types';
import { earField, reliefAt, type EarField } from './ear-field';
import { fy } from './units';

/** Oreille posée sur la tête : modèle du moteur d'oreille, placement en U (hauteur, attache) et z de l'arête antérieure. */
export interface EarRig { readonly side: 1 | -1; readonly model: EarModel; readonly field: EarField; readonly pl: EarPlacement; readonly zA: number; readonly T: number; readonly pivot: { x: number; y: number } }

export function earRig(spec: HeadTurnSpec, side: 1 | -1): EarRig {
  const e = spec.engine;
  if (!e) throw new Error('earRig : la spec ne porte pas de tête issue des moteurs');
  const model = earModel(e.p.ears, side), { pl: px } = earPlacement(e.p, e.lm, model);
  const hU = px.hPx / 1000, zA = e.fit.zPorion + Math.cos(rad(px.openingDeg)) * (model.landmarks.canal as { x: number }).x * hU, sink = e.p.ears.attach.insertion * 0.04 * hU;
  // Attache : abscisse de la surface du crâne à la hauteur y ET à la profondeur zA (ellipse de la section), pas la largeur maximale du contour.
  const skullX = (y: number): number => { const s = sectionAt(spec, y), d = (zA - s.zc) / s.b; return Math.max(0, s.a * Math.sqrt(Math.max(0, 1 - d * d)) - sink); };
  // `placeEarPoint` applique `side × rotationDeg`, alors que le plan de l'oreille gauche n'est PAS miroité (u : avant → arrière pour les deux côtés) : sans compensation
  // l'oreille gauche pencherait à l'opposé de la droite (écart mesuré 0,067 U). On passe `side × rotationDeg` pour que la rotation dans le plan soit la même des deux côtés.
  const pl: EarPlacement = { ...px, hPx: hU, topY: fy(px.topY), skullX, rotationDeg: side * px.rotationDeg };
  return { side, model, field: earField(model), pl, zA, T: model.thickness * hU, pivot: model.landmarks.crus as { x: number; y: number } };
}

/** Point (u, v) du plan à la hauteur de relief h (unités d'épaisseur) → repère de la tête. */
export function earPoint(r: EarRig, u: number, v: number, h: number): V3 {
  const p = placeEarPoint(r.pl, { x: u, y: v }, h * r.T, r.pivot);
  return v3(p.X, p.y, r.zA + p.Z);
}

const RINGS = 22;
/** Maillage fermé du pavillon : face externe (relief du moteur) → rebord → dos plat. Rangées radiales depuis le centre du contour, une rangée par point du contour. */
export function earMesh(r: EarRig): Mesh[] {
  const o = r.model.outline, n = o.length, c = { x: o.reduce((s, q) => s + q.x, 0) / n, y: o.reduce((s, q) => s + q.y, 0) / n };
  const back = -0.35, rows: V3[][] = [], uv: [number, number][][] = [];
  const ring = (t: number, front: boolean): void => {
    rows.push(o.map((q) => { const u = c.x + t * (q.x - c.x), v = c.y + t * (q.y - c.y); const rel = reliefAt(r.field, u, v); return earPoint(r, u, v, front ? rel : back + 0.45 * rel); }));
    uv.push(o.map((q) => [c.x + t * (q.x - c.x), c.y + t * (q.y - c.y)] as [number, number]));
  };
  for (let i = 0; i <= RINGS; i++) ring(i / RINGS, true);
  for (let i = RINGS; i >= 0; i--) ring(i / RINGS, false);
  const nE = v3(r.side * Math.cos(rad(r.pl.openingDeg)), 0, Math.sin(rad(r.pl.openingDeg)));
  const mesh = gridMesh(PART.ear, rows, true, (i, j) => { const f = i <= RINGS, q = uv[i]![j]!; const p = earPoint(r, q[0], q[1], f ? -3 : 3); void nE; return p; }, uv);
  return [mesh];
}
