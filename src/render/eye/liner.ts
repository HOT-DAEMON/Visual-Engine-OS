import { lighten } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import { gradientStop as stop } from '../../materials';
import { linerGeometry, type OpeningGeometry } from '../../geometry/eye';
import type { EyeSpec } from '../../schema';
import { P, smoothThrough } from './helpers';

export interface LinerRender {
  readonly defs: string[];
  readonly markup: string[];
}

/**
 * Liner ailé : une seule forme pleine (bord haut lissé jusqu'à la pointe de l'aile, retour par le
 * bord bas), éventuellement en dégradé couleur → couleur de pointe, une fine ligne de brillance
 * sur le bord haut, et un liner inférieur effilé si demandé. La géométrie est dans
 * geometry/eye/liner.ts ; ici, uniquement le dessin.
 */
export function renderLiner(eye: EyeSpec, g: OpeningGeometry, th: number, lidColor: string, id: string): LinerRender {
  const liner = eye.lids.liner;
  if (!liner) return { defs: [], markup: [] };
  const defs: string[] = [];
  const markup: string[] = [];
  const geo = linerGeometry(g, liner, th);
  const color = liner.color ?? lidColor;

  let fill = color;
  if (liner.tipColor) {
    defs.push(
      el('linearGradient', { id: `${id}-liner-grad`, gradientUnits: 'userSpaceOnUse', x1: geo.start.x, y1: geo.start.y, x2: geo.tip.x, y2: geo.tip.y }, [
        stop(0, color),
        stop(0.55, color),
        stop(1, liner.tipColor),
      ]),
    );
    fill = urlRef(`${id}-liner-grad`);
  }

  const first = geo.top[0]!;
  const d = `M${P(first)}${smoothThrough(geo.top)}${smoothThrough(geo.bottom)}L${P(first)}Z`;
  markup.push(el('path', { id: `${id}-liner`, d, fill, 'fill-opacity': liner.opacity }));

  if (geo.lower.length > 0) {
    const l0 = geo.lower[0]!;
    markup.push(el('path', { d: `M${P(l0)}${smoothThrough(geo.lower)}Z`, fill: color, 'fill-opacity': liner.opacity }));
  }

  if (liner.gloss > 0.01 && geo.gloss.length > 2) {
    const g0 = geo.gloss[0]!;
    markup.push(
      el('path', {
        d: `M${P(g0)}${smoothThrough(geo.gloss)}`,
        fill: 'none',
        stroke: lighten(color, 0.55),
        'stroke-width': Math.max(0.4, th * 0.1),
        'stroke-opacity': 0.55 * liner.gloss * liner.opacity,
        'stroke-linecap': 'round',
      }),
    );
  }
  return { defs, markup };
}
