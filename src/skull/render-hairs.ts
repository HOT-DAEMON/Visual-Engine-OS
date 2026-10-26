import { mix } from '../core/color';
import { el, num } from '../core/svg';
import type { FaceFacialHair, FaceHair } from '../schema';
import type { BeardShape } from './beard-shape';
import type { HairShape } from './hair-shape';
import { smoothPath } from './spline';
import type { CPoint } from './types';

/** Peinture des cheveux et de la pilosité de profil : aplat à dégradé racine → pointe, bandes d'ombre et de reflet cel, mèches, contour d'encre. */
/** Contour fermé LISSÉ (angles vifs là où `s` est élevé) : une chevelure n'a pas de coins de polygone. */
const poly = (p: readonly CPoint[]): string => smoothPath(p, true);
export interface PaintOut { readonly defs: string[]; readonly back: string[]; readonly front: string[] }

export function paintHair(s: HairShape, h: FaceHair, H: number, ink: string): PaintOut {
  const c = h.color;
  const root = h.rootColor ?? mix(c, '#000000', 0.32);
  const tip = mix(c, '#ffffff', 0.03 + 0.1 * h.highlight);
  const shade = mix(c, '#000000', 0.4), lit = mix(c, '#ffffff', 0.3);
  const id = 'sk-hair-grad';
  const defs = [el('linearGradient', { id, x1: 0, y1: num(s.top), x2: 0, y2: num(s.bottom), gradientUnits: 'userSpaceOnUse' }, [el('stop', { offset: 0, 'stop-color': root }), el('stop', { offset: 0.3, 'stop-color': c }), el('stop', { offset: 1, 'stop-color': tip })])];
  const lw = H * 0.0032;
  const back: string[] = [];
  const front: string[] = [];
  const fill = `url(#${id})`;
  for (const e of s.extra) (s.style === 'ponytail' || s.style === 'braids' ? back : front).push(el('path', { d: poly(e), fill, stroke: ink, 'stroke-width': num(lw), 'stroke-linejoin': 'round' }));
  if (s.bun) back.push(el('circle', { cx: num(s.bun.cx), cy: num(s.bun.cy), r: num(s.bun.r), fill, stroke: ink, 'stroke-width': num(lw) }));
  front.push(el('path', { d: poly(s.mass), fill, stroke: ink, 'stroke-width': num(lw), 'stroke-linejoin': 'round' }));
  const st = s.strands;
  st.forEach((l, i) => { if (l.length > 2) front.push(el('path', { d: smoothPath(l), fill: 'none', stroke: shade, 'stroke-width': num(H * 0.0032), opacity: 0.4, 'stroke-linecap': 'round' })); void i; });
  const mid = st[Math.floor(st.length * 0.6)];
  if (mid && mid.length > 6) front.push(el('path', { d: smoothPath(mid.slice(Math.floor(mid.length * 0.3), Math.floor(mid.length * 0.85))), fill: 'none', stroke: lit, 'stroke-width': num(H * 0.011), opacity: 0.5, 'stroke-linecap': 'round' }));
  return { defs, back, front };
}

export function paintFacialHair(b: BeardShape, fh: FaceFacialHair, hairColor: string, H: number, ink: string): string[] {
  void ink;
  const c = fh.color ?? mix(hairColor, '#000000', 0.15);
  const out: string[] = [];
  const op = Math.max(0.35, fh.density);
  const lw = H * 0.003;
  const stubble = b.style === 'stubble';
  if (b.beard) out.push(el('path', { d: poly(b.beard), fill: c, opacity: stubble ? 0.28 * op : 0.92 * op }));
  if (b.sideburn) out.push(el('path', { d: poly(b.sideburn), fill: c, opacity: 0.92 * op }));
  if (b.mustache) out.push(el('path', { d: poly(b.mustache), fill: c, opacity: op, stroke: ink, 'stroke-width': num(lw), 'stroke-linejoin': 'round' }));
  for (const d of b.dots) out.push(el('circle', { cx: num(d.x), cy: num(d.y), r: num(H * 0.0028), fill: c, opacity: 0.7 }));
  return out;
}
