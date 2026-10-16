import { num } from '../../core/svg';
import type { Poly } from '../../face/poly';

/** Chemin SVG fermé d'un ou plusieurs polygones (sous-chemins de même sens : leur union se remplit sans trou). */
export const polyPath = (...polys: Poly[]): string =>
  polys.map((p) => `M${p.map((v) => `${num(v.x)} ${num(v.y)}`).join('L')}Z`).join('');
