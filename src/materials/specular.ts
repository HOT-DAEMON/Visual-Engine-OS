import { mix } from '../core/color';
import { clamp01 } from '../core/math';
import { direction2D, halfVectorXY, type LightVector } from '../lighting/light';
import { el, urlRef } from '../core/svg';
import type { MaterialDescriptor } from '../schema';
import { gradientStop as stop, spotGradient, dominantColor, type CompiledSurface, type Surface } from './surface';
import { SHADING } from './shading';

interface SpecularOut {
  readonly defs: string[];
  readonly nodes: string[];
}

/** Reflet spéculaire + vernis. Partagé entre `compileSurface` (surface opaque) et `compileGloss` (couche transparente). */
export function specularLayers(
  id: string,
  surface: Surface,
  m: MaterialDescriptor,
  L: LightVector,
  base: string,
): SpecularOut {
  const S = SHADING;
  const { bbox } = surface;
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const rx = bbox.w / 2;
  const ry = bbox.h / 2;
  const dir = direction2D(L);
  const lenXY = Math.hypot(L.x, L.y);
  const defs: string[] = [];
  const nodes: string[] = [];
  const specColor = mix(L.color, base, S.metalTint * m.metallic);

  if (surface.curvature === 'sphere') {
    const H = halfVectorXY(L);
    const hx = cx + H.x * rx;
    const hy = cy + H.y * ry;
    const size = S.specSizeMin + S.specSizeRough * m.roughness;
    const alpha = clamp01(L.intensity * (S.specAlphaMax - S.specAlphaRough * m.roughness));
    const soft = S.specSoftMin + S.specSoftRough * m.roughness;
    defs.push(spotGradient(`${id}-spec`, specColor, alpha, soft));
    nodes.push(el('ellipse', { cx: hx, cy: hy, rx: rx * size, ry: ry * size, fill: urlRef(`${id}-spec`) }));
    if (m.clearcoat > 0) {
      defs.push(spotGradient(`${id}-coat`, L.color, clamp01(L.intensity * m.clearcoat * S.coatAlpha), S.coatSoft));
      nodes.push(el('ellipse', { cx: hx, cy: hy, rx: rx * S.coatSize, ry: ry * S.coatSize, fill: urlRef(`${id}-coat`) }));
    }
  } else {
    const k = Math.min(1, lenXY * 1.2);
    const band = (bid: string, width: number, alpha: number): void => {
      const c = S.flatBandCenter;
      defs.push(
        el(
          'linearGradient',
          { id: bid, x1: 0.5 + dir.x * 0.5, y1: 0.5 + dir.y * 0.5, x2: 0.5 - dir.x * 0.5, y2: 0.5 - dir.y * 0.5 },
          [
            stop(0, specColor, 0),
            stop(c - width, specColor, 0),
            stop(c, specColor, alpha),
            stop(c + width, specColor, 0),
            stop(1, specColor, 0),
          ],
        ),
      );
      nodes.push(surface.draw({ fill: urlRef(bid) }));
    };
    band(`${id}-spec`, 0.05 + 0.28 * m.roughness, clamp01(L.intensity * k * (0.9 - 0.7 * m.roughness)));
    if (m.clearcoat > 0) band(`${id}-coat`, 0.02, clamp01(L.intensity * k * m.clearcoat * 0.9));
  }
  return { defs, nodes };
}

/**
 * Couche de brillance seule (reflet + vernis), sans couleur de base : pour du verre, un vernis
 * ou un dôme posé par-dessus une autre surface. Utilise les mêmes formules que `compileSurface`.
 */
export function compileGloss(id: string, surface: Surface, m: MaterialDescriptor, L: LightVector): CompiledSurface {
  const spec = specularLayers(id, surface, m, L, dominantColor(m.base));
  const defs = [...spec.defs, el('clipPath', { id: `${id}-clip` }, [surface.draw({})])];
  return { defs, markup: el('g', { 'clip-path': urlRef(`${id}-clip`) }, spec.nodes) };
}
