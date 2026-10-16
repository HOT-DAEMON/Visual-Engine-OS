import { darken, lighten } from '../../core/color';
import { mulberry32 } from '../../core/prng';
import { el, num } from '../../core/svg';
import type { HairGeometry } from '../../face/hair-geometry';
import { polyBox } from '../../face/poly';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceLandmarks } from '../../face';
import type { FaceParams } from '../../schema';

const f = (v: Vec): string => `${num(v.x)} ${num(v.y)}`;

/**
 * Brins (traits fins sombres et clairs) + reflet en arc, à dessiner DANS le clip de la chevelure :
 * rayonnent depuis la raie vers le contour, suivent la frange, descendent le long des rideaux (bob/long).
 * Déterministes (graine des cheveux).
 */
export function hairStrands(p: FaceParams, lm: FaceLandmarks, geo: HairGeometry): string[] {
  const h = p.hair;
  const rnd = mulberry32(h.seed ^ 0x9e3779b9);
  const color = h.color;
  const out: string[] = [];
  const box = polyBox(geo.front[0] as never);
  const sw = lm.W * 0.0042;
  const stroke = (d: string, dark: boolean): string =>
    el('path', { d, fill: 'none', stroke: dark ? darken(color, 0.38) : lighten(color, 0.38), 'stroke-width': sw * (0.6 + 0.9 * rnd()), 'stroke-linecap': 'round', opacity: dark ? 0.3 : 0.18 });
  const O = geo.origin;
  const radiate = (E: Vec): string => {
    const dx = E.x - O.x;
    const dy = E.y - O.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = (rnd() - 0.35) * 0.16 * len;
    const n = { x: -dy / len, y: dx / len };
    const a = { x: O.x + dx * 0.35 + n.x * bow, y: O.y + dy * 0.35 + n.y * bow };
    const b = { x: O.x + dx * 0.72 + n.x * bow * 0.6, y: O.y + dy * 0.72 + n.y * bow * 0.6 };
    return `M${f(O)}C${f(a)} ${f(b)} ${f(E)}`;
  };
  if (h.style !== 'buzz') {
    for (const E of geo.ends) {
      out.push(stroke(radiate(E), true));
      out.push(stroke(radiate({ x: E.x + (rnd() - 0.5) * 0.03 * lm.W, y: E.y + (rnd() - 0.5) * 0.02 * lm.H }), false));
    }
    if (geo.fringeBottom) {
      geo.fringeBottom.forEach((E, i) => {
        if (i % 2 === 0) out.push(stroke(radiate(E), i % 4 === 0));
      });
    }
  }
  if (h.style === 'bob' || h.style === 'long') {
    const { xIn, xOut, y0, y1 } = geo.side;
    for (const sg of [-1, 1] as const) {
      for (let m = 0; m < 16; m++) {
        const t = (m + 0.5) / 16;
        const at = (y: number): Vec => ({ x: sg * (xIn(y) + (xOut(y) - xIn(y)) * t), y });
        const A = at(y0);
        const B = at(y1);
        const sway = (rnd() - 0.5) * 0.03 * lm.W;
        out.push(stroke(`M${f(A)}C${f({ x: A.x + sway, y: A.y + (B.y - A.y) * 0.35 })} ${f({ x: B.x - sway, y: A.y + (B.y - A.y) * 0.7 })} ${f(B)}`, m % 2 === 0));
      }
    }
  }
  // Reflet « auréole » : arc clair parallèle au dôme, décalé côté lumière.
  const hl = { x0: box.x + box.w * 0.2, x1: box.x + box.w * 0.8, y: box.y + box.h * 0.34, top: box.y + box.h * 0.06 };
  const arc = `M${num(hl.x0)} ${num(hl.y)}Q${num(box.x + box.w / 2)} ${num(hl.top - box.h * 0.05)} ${num(hl.x1)} ${num(hl.y)}`;
  out.push(el('path', { d: arc, fill: 'none', stroke: lighten(color, 0.55), 'stroke-width': lm.W * 0.05, 'stroke-linecap': 'round', opacity: 0.16 }));
  out.push(el('path', { d: arc, fill: 'none', stroke: lighten(color, 0.7), 'stroke-width': lm.W * 0.018, 'stroke-linecap': 'round', opacity: 0.22 }));
  return out;
}
