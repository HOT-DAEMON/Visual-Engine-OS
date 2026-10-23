import { halfWidthAt } from './outline';
import { rotate } from './curve';
import type { FaceLandmarks } from './landmarks';
import type { Vec } from '../geometry/eye/primitives';
import type { FaceParams } from '../schema';
import type { Poly } from './poly';
import { earModel } from './ear/geometry';
import { earPlacement, type EarAlignment } from './ear/place';
import { hull, projectEar, type EarPlacement, type ProjectedEar } from './ear/project';
import type { EarModel } from './ear/types';

/** Oreille : centre, demi-axes, inclinaison et polygone (repère de l'hôte). Source unique du rendu, des ombres de contact et de la vérification. */
export interface EarGeo {
  readonly side: -1 | 1;
  readonly c: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly tiltDeg: number;
  readonly poly: Poly;
  /** Moteur `morphology` : le modèle (plan), son placement dans l'hôte, la vue de face projetée et les écarts d'alignement mesurés. */
  readonly model?: EarModel;
  readonly placement?: EarPlacement;
  readonly front?: ProjectedEar;
  readonly align?: EarAlignment;
}

/** Moteur d'oreille effectif : `auto` suit le moteur d'anatomie (`structured` → `morphology`). */
export const earEngine = (p: FaceParams): 'classic' | 'morphology' => (p.ears.engine === 'auto' ? (p.anatomyEngine === 'structured' ? 'morphology' : 'classic') : p.ears.engine);

/** Oreilles posées sur le contour entre la ligne des yeux et la base du nez ; vide si `ears.visible` est faux. */
export function earGeometry(p: FaceParams, lm: FaceLandmarks): EarGeo[] {
  if (!p.ears.visible) return [];
  if (earEngine(p) === 'morphology') return ([-1, 1] as const).map((side) => morphologyEar(p, lm, side));
  const w = p.ears.size * lm.W;
  const h = w * p.ears.aspect;
  const cy = (lm.eyeY + lm.noseBaseY) / 2;
  return ([-1, 1] as const).map((side) => {
    const c = { x: side * (halfWidthAt(lm.outline, cy) + w * 0.18), y: cy };
    const tilt = side * p.ears.tiltDeg;
    const poly: Poly = Array.from({ length: 28 }, (_, i) => {
      const a = (2 * Math.PI * i) / 28;
      const r = rotate({ x: (w / 2) * Math.cos(a), y: (h / 2) * Math.sin(a) }, tilt);
      return { x: c.x + r.x, y: c.y + r.y };
    });
    return { side, c, rx: w / 2, ry: h / 2, tiltDeg: tilt, poly };
  });
}

/** Oreille du moteur `morphology` : silhouette = enveloppe de la plaque et du bord de l'hélix projetés de face (source des ombres de contact et des cheveux). */
function morphologyEar(p: FaceParams, lm: FaceLandmarks, side: -1 | 1): EarGeo {
  const model = earModel(p.ears, side);
  const { pl, align } = earPlacement(p, lm, model);
  const front = projectEar(model, pl, 0, 'face');
  const poly = hull([...front.plate, ...front.rim]);
  const b = front.bbox;
  return { side, c: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, rx: (b.x1 - b.x0) / 2, ry: (b.y1 - b.y0) / 2, tiltDeg: side * p.ears.attach.rotationDeg, poly, model, placement: pl, front, align };
}
