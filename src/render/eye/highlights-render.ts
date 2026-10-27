import { halfVectorXY, type LightVector } from '../../lighting/light';
import { placeHighlights, type OpeningGeometry, type PlacedHighlight, type Vec } from '../../geometry/eye';
import type { EyeSpec } from '../../schema';
import { el, urlRef } from '../../core/svg';
import { polygonPath, smoothClosed } from './helpers';

/**
 * OPT-01/04 — Peinture des reflets détaillés (placement et règle d'occlusion : geometry/eye/highlights.ts).
 * Les reflets `light` suivent le vecteur médian de la lumière LOCALE (cause physique) ; `iris` et `globe` sont des choix de composition.
 * Chaque reflet : forme, rotation, couleur, opacité, douceur (flou), halo d'intensité (bloom). Confinement à l'iris par clipPath.
 */
export interface HighlightsRender {
  readonly defs: string[];
  readonly markup: string[];
}

function shapeMarkup(p: PlacedHighlight, attrs: Record<string, string | number>): string {
  const { item } = p;
  if (p.outline.length === 0) {
    return el('ellipse', { cx: p.cx, cy: p.cy, rx: p.rx, ry: p.ry, ...(item.rotationDeg ? { transform: `rotate(${item.rotationDeg} ${p.cx} ${p.cy})` } : {}), ...attrs });
  }
  const pts: Vec[] = p.outline.map((v) => ({ x: v.x + p.cx, y: v.y + p.cy }));
  return el('path', { d: item.shape === 'star' ? smoothClosed(pts) : polygonPath(pts), ...attrs });
}

export function renderHighlights(eye: EyeSpec, g: OpeningGeometry, c: Vec, localLight: LightVector, irisRx: number, irisRy: number, lightColor: string, id: string): HighlightsRender {
  const defs: string[] = [];
  const markup: string[] = [];
  const placed = placeHighlights(eye.highlights.list, { c, irisRx, irisRy, half: halfVectorXY(localLight), bbox: g.bbox });
  const needIrisClip = placed.some((p) => p.item.confine === 'iris');
  if (needIrisClip) defs.push(el('clipPath', { id: `${id}-hl-iris` }, [el('ellipse', { cx: c.x, cy: c.y, rx: irisRx, ry: irisRy })]));

  placed.forEach((p, i) => {
    const { item } = p;
    const color = item.color ?? lightColor;
    const out: string[] = [];
    if (item.intensity > 0) {
      const gid = `${id}-hl${i}-glow`;
      defs.push(el('filter', { id: gid, x: '-100%', y: '-100%', width: '300%', height: '300%' }, [el('feGaussianBlur', { stdDeviation: Math.max(p.rx, p.ry) * (0.45 + 0.5 * item.intensity) })]));
      out.push(shapeMarkup({ ...p, rx: p.rx * 1.35, ry: p.ry * 1.35, outline: p.outline.map((v) => ({ x: v.x * 1.35, y: v.y * 1.35 })) }, { fill: color, 'fill-opacity': Math.min(1, item.opacity * item.intensity * 0.8), filter: urlRef(gid) }));
    }
    const attrs: Record<string, string | number> = { fill: color, 'fill-opacity': item.opacity };
    if (item.softness > 0) {
      const sid = `${id}-hl${i}-soft`;
      defs.push(el('filter', { id: sid, x: '-50%', y: '-50%', width: '200%', height: '200%' }, [el('feGaussianBlur', { stdDeviation: item.softness * 0.35 * Math.min(p.rx, p.ry) })]));
      attrs.filter = urlRef(sid);
    }
    out.push(shapeMarkup(p, attrs));
    markup.push(item.confine === 'iris' ? el('g', { 'clip-path': urlRef(`${id}-hl-iris`) }, out) : out.length === 1 ? (out[0] as string) : el('g', {}, out));
  });
  return { defs, markup };
}
