import { toLocal, type LightVector } from '../lighting/light';
import { compileSurface, type Surface } from '../materials';
import { objectTransform, type CompiledObject } from './object';
import type { PanelSpec } from '../schema';
import { el } from '../core/svg';

/** Panneau rectangulaire : sert de preuve que le système de matériaux n'est pas propre à l'œil. */
export function compilePanel(p: PanelSpec, worldLight: LightVector): CompiledObject {
  const L = toLocal(worldLight, p.transform.rotationDeg);
  const x = -p.width / 2;
  const y = -p.height / 2;
  const rx = Math.min(p.cornerRadius, p.width / 2, p.height / 2);
  const surface: Surface = {
    bbox: { x, y, w: p.width, h: p.height },
    curvature: 'flat',
    draw: (a) => el('rect', { x, y, width: p.width, height: p.height, rx, ...a }),
  };
  const out = compileSurface(`${p.id}-surface`, surface, p.material, L, p.transform.rotationDeg);
  return { defs: out.defs, markup: el('g', { transform: objectTransform(p.transform) }, [out.markup]) };
}
