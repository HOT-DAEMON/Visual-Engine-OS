import { toLocal, type LightVector } from '../lighting/light';
import { compileSurface, type Surface } from '../materials';
import { objectTransform, type CompiledObject } from './object';
import { resolveAnchors } from '../composition/anchors';
import type { HostSpec } from '../schema';
import { el } from '../core/svg';
import { faceParts, faceSurface } from './face';

/** Hôte : surface (ellipse bombée ou rectangle plat) habillée par le système de matériaux partagé. */
export function compileHost(h: HostSpec, worldLight: LightVector): CompiledObject {
  const rot = h.transform.rotationDeg;
  const L = toLocal(worldLight, rot);
  const rx = h.width / 2;
  const ry = h.height / 2;
  const bbox = { x: -rx, y: -ry, w: h.width, h: h.height };
  const parts = h.shape === 'face' ? faceParts(h, L, rot) : null;
  const surface: Surface = parts
    ? faceSurface(h, parts.lm)
    : h.shape !== 'rounded_rect'
      ? { bbox, curvature: 'sphere', draw: (a) => el('ellipse', { cx: 0, cy: 0, rx, ry, ...a }) }
      : {
          bbox,
          curvature: 'flat',
          draw: (a) =>
            el('rect', {
              x: -rx,
              y: -ry,
              width: h.width,
              height: h.height,
              rx: Math.min(h.cornerRadius, rx, ry),
              ...a,
            }),
        };
  // Matériau de peau (par défaut) : remplace l'ombrage générique ; `legacy` conserve `compileSurface`.
  const out = parts?.skin ? { defs: [], markup: parts.skin.markup } : compileSurface(`${h.id}-surface`, surface, h.material, L, rot);

  const children = parts ? [...parts.behind, out.markup, ...parts.front] : [out.markup];
  if (h.showAnchors) {
    const r = Math.max(3, Math.min(h.width, h.height) * 0.012);
    const marks = resolveAnchors(h).map((a) =>
      el('g', { transform: `translate(${a.x} ${a.y}) rotate(${a.rotationDeg})` }, [
        el('circle', { cx: 0, cy: 0, r: r * 2, fill: 'none', stroke: '#ff2d95', 'stroke-width': r * 0.4 }),
        el('path', { d: `M${-r * 3} 0H${r * 3}M0 ${-r * 3}V${r * 3}`, fill: 'none', stroke: '#ff2d95', 'stroke-width': r * 0.4 }),
        el('path', { d: `M0 ${-r * 3}L${r} ${-r * 4.6}L${-r} ${-r * 4.6}Z`, fill: '#ff2d95' }),
      ]),
    );
    children.push(el('g', {}, marks));
  }
  const overlay = parts && parts.over.length ? el('g', { transform: objectTransform(h.transform) }, parts.over) : undefined;
  return { defs: [...out.defs, ...(parts?.defs ?? [])], markup: el('g', { transform: objectTransform(h.transform) }, children), ...(overlay ? { overlay } : {}) };
}
