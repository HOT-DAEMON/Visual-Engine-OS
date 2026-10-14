import { darken, lighten } from '../../core/color';
import { halfVectorXY, toLocal, type LightVector } from '../../lighting/light';
import { compileSurface, type Surface } from '../../materials';
import { openingGeometry } from '../../geometry/eye';
import type { GemEyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';
import { objectTransform, type CompiledObject } from '../object';
import { gemFacets } from './facets';

const poly = (pts: readonly { x: number; y: number }[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`).join('') + 'Z';

/**
 * Œil de gemme : réutilise l'enveloppe palpébrale de l'œil anime (`geometry/eye/opening.ts`), mais
 * remplace l'iris/la pupille par un disque de facettes triangulaires façon pierre taillée. Le motif
 * des facettes est déterministe (voir facets.ts) ; seul le reflet « étincelle » dépend de la lumière.
 */
export function compileGemEye(g: GemEyeSpec, worldLight: LightVector): CompiledObject {
  const id = g.id;
  const rot = g.transform.rotationDeg;
  const L = toLocal(worldLight, rot);
  const geo = openingGeometry(g.shape, { inner: { caruncle: 0, color: '#000000', roundness: 0.4 }, outer: { roundness: 0.2 } });
  const openD = `M${num(geo.pi.x)} ${num(geo.pi.y)}C${num(geo.u1.x)} ${num(geo.u1.y)} ${num(geo.u2.x)} ${num(geo.u2.y)} ${num(geo.po.x)} ${num(geo.po.y)}C${num(geo.l1.x)} ${num(geo.l1.y)} ${num(geo.l2.x)} ${num(geo.l2.y)} ${num(geo.pi.x)} ${num(geo.pi.y)}Z`;
  const defs: string[] = [];
  const body: string[] = [];

  defs.push(el('clipPath', { id: `${id}-opening` }, [el('path', { d: openD })]));

  const scleraSurface: Surface = { bbox: geo.bbox, curvature: 'sphere', draw: (a) => el('path', { d: openD, ...a }) };
  const sclera = compileSurface(`${id}-sclera`, scleraSurface, g.sclera, L, rot);
  defs.push(...sclera.defs);
  body.push(sclera.markup);

  const R = Math.min(geo.bbox.w, geo.bbox.h) * 0.46;
  const cx = geo.bbox.x + geo.bbox.w / 2;
  const cy = geo.bbox.y + geo.bbox.h / 2;
  const inner: string[] = [];
  for (const f of gemFacets(g.facets, R, R * 0.42)) {
    const color = f.tone >= 0 ? lighten(g.gemColor, f.tone) : darken(g.gemColor, -f.tone);
    inner.push(el('path', { d: poly(f.points.map((p) => ({ x: cx + p.x, y: cy + p.y }))), fill: color, stroke: darken(g.gemColor, 0.55), 'stroke-width': R * 0.012 }));
  }
  // Table centrale (facette plate du dessus) et étincelle positionnée par la lumière.
  inner.push(el('circle', { cx, cy, r: R * 0.22, fill: lighten(g.gemColor, 0.3) }));
  const H = halfVectorXY(L);
  defs.push(
    el('radialGradient', { id: `${id}-sparkle`, cx: 0.5, cy: 0.5, r: 0.5 }, [
      el('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': g.sparkle }),
      el('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0 }),
    ]),
  );
  inner.push(
    el('circle', { cx: cx + H.x * R * 0.3, cy: cy + H.y * R * 0.3, r: R * 0.5, fill: urlRef(`${id}-sparkle`) }),
  );

  body.push(el('g', { 'clip-path': urlRef(`${id}-opening`) }, inner));
  body.push(
    el('path', { d: openD, fill: 'none', stroke: darken(g.gemColor, 0.5), 'stroke-width': geo.h * 0.04, 'stroke-opacity': 0.5 }),
  );

  return { defs, markup: el('g', { transform: objectTransform(g.transform) }, body) };
}
