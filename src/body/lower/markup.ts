import { memoPure } from '../../perf';
import { bodyMarkup } from '../markup';
import type { BodyMarkup, BodyRenderOpts } from '../render';
import { box } from '../shape';
import { BodyParams, type BodyInput, type NeckAnchor } from '../types';
import { legGeometry, type LegGeo } from './geometry';
import { renderLegs } from './render';
import { LegParams, type LegInput } from './types';

const build = (bp: BodyParams, lp: LegParams, a: NeckAnchor, o: BodyRenderOpts): BodyMarkup => {
  const up = bodyMarkup(bp, a, o), lo = renderLegs(legGeometry(bp, lp, a), o);
  return { back: lo.back + up.back, front: up.front };
};
const memo = memoPure('figure-svg', 'svg', build, 128);
/** SVG de la FIGURE (bas puis haut du corps), mémoïsé par le contenu. Le bas est peint DERRIÈRE le tronc ; `front` = fondu du cou, à peindre après le visage. */
export const figureMarkup = (body: BodyInput, legs: LegInput, a: NeckAnchor, o: BodyRenderOpts): BodyMarkup => memo(BodyParams.parse(body), LegParams.parse(legs), a, o);

/** Boîte englobante des atomes visibles de la figure entière (haut + bas) + marge, pour recadrer l'image au plus juste. */
export function figureBounds(geo: LegGeo, margin = 0.08): { x0: number; y0: number; x1: number; y1: number } {
  const b = box([...geo.body.atoms, ...geo.atoms].filter((q) => q.view === 'front' && q.id !== 'neck').flatMap((q) => [...q.poly])), m = margin * geo.frame.body.h;
  return { x0: b.x0 - m, y0: Math.min(b.y0, geo.frame.body.a.chinY) - m, x1: b.x1 + m, y1: b.y1 + m };
}
