import { darken, lighten } from '../../core/color';
import { browGeometry, browHairs, type OpeningGeometry } from '../../geometry/eye';
import { type LightVector } from '../../lighting/light';
import { compileSurface, dominantColor, type Surface } from '../../materials';
import type { EyeSpec } from '../../schema';
import { el } from '../../core/svg';
import { P, smoothClosed } from './helpers';

export interface EyebrowRender {
  readonly defs: string[];
  readonly outside: string[];
}

/** Sourcil : contour rempli par le système de matériaux partagé + poils individuels seedés. */
export function renderEyebrow(eye: EyeSpec, g: OpeningGeometry, L: LightVector, rot: number, id: string): EyebrowRender {
  const defs: string[] = [];
  const outside: string[] = [];
  if (!eye.eyebrow) return { defs, outside };

    const brow = eye.eyebrow;
    const bg = browGeometry(g, brow, eye.lids.crease.height);
    const browSurface: Surface = {
      bbox: bg.bbox,
      curvature: 'flat',
      draw: (a) => el('path', { d: smoothClosed(bg.outline), ...a }),
    };
    const browOut = compileSurface(`${id}-brow`, browSurface, brow.material, L, rot);
    defs.push(...browOut.defs);
    // Groupe identifiable (et non les chemins internes, qui seraient dupliqués car compileSurface
    // appelle `draw` plusieurs fois) : sert de point d'ancrage stable pour les tests bout-en-bout
    // qui vérifient la coordination inter-yeux sur le SVG final.
    outside.push(el('g', { id: `${id}-brow` }, [browOut.markup]));
    const hairs = browHairs(bg, brow.hairs, (eye.seed ^ 0x3c3c3c3c) >>> 0, g.h);
    if (hairs.length > 0) {
      const base = dominantColor(brow.material.base);
      const lightC = lighten(base, 0.3);
      const darkC = darken(base, 0.4);
      outside.push(
        el(
          'g',
          { id: `${id}-brow-hairs`, fill: 'none', 'stroke-linecap': 'round', 'stroke-opacity': 0.55, 'stroke-width': Math.max(0.5, g.h * 0.006) },
          hairs.map((h) =>
            el('path', { d: `M${P(h.p0)}Q${P(h.p1)} ${P(h.p2)}`, stroke: h.light ? lightC : darkC }),
          ),
        ),
      );
    }

  return { defs, outside };
}
