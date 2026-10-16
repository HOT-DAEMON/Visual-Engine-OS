import { darken } from '../../core/color';
import { el } from '../../core/svg';
import { halfWidthAt } from '../../face';
import type { FaceLandmarks } from '../../face';
import type { FaceParams } from '../../schema';

/** Oreilles : posées sur le contour du crâne entre la ligne des yeux et la base du nez (dessinées DERRIÈRE la tête). */
export function renderEars(p: FaceParams, lm: FaceLandmarks, skin: string): string[] {
  if (!p.ears.visible) return [];
  const w = p.ears.size * lm.W;
  const h = w * p.ears.aspect;
  const cy = (lm.eyeY + lm.noseBaseY) / 2;
  const out: string[] = [];
  for (const sg of [-1, 1] as const) {
    const cx = sg * (halfWidthAt(lm.outline, cy) + w * 0.18);
    out.push(
      el('g', { transform: `translate(${cx} ${cy}) rotate(${sg * p.ears.tiltDeg})` }, [
        el('ellipse', { cx: 0, cy: 0, rx: w / 2, ry: h / 2, fill: skin, stroke: darken(skin, 0.35), 'stroke-width': w * 0.05 }),
        el('ellipse', { cx: sg * -w * 0.04, cy: h * 0.02, rx: w * 0.26, ry: h * 0.32, fill: darken(skin, 0.18), opacity: 0.7 }),
      ]),
    );
  }
  return out;
}
