import type { ResolvedAppearance } from '../../appearance';
import { el } from '../../core/svg';
import { earGeometry } from '../../face';
import type { FaceLandmarks } from '../../face';
import type { FaceParams } from '../../schema';

/** Oreilles : posées sur le contour du crâne (géométrie dans `face/ears-geometry.ts`), dessinées DERRIÈRE la tête. */
export function renderEars(p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance): string[] {
  return earGeometry(p, lm).map((e) => {
    const w = e.rx * 2;
    const h = e.ry * 2;
    const sg = e.side;
    return el('g', { transform: `translate(${e.c.x} ${e.c.y}) rotate(${e.tiltDeg})` }, [
      el('ellipse', { cx: 0, cy: 0, rx: w / 2, ry: h / 2, fill: skin, stroke: ra.tone(-0.8, skin), 'stroke-width': w * 0.05 }),
      el('ellipse', { cx: sg * -w * 0.04, cy: h * 0.02, rx: w * 0.26, ry: h * 0.32, fill: ra.tone(-0.4, skin), opacity: 0.7 }),
    ]);
  });
}
