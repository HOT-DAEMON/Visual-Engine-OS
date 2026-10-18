import { el, num, urlRef } from '../../core/svg';

/**
 * Kit de formes DOUCES (flou) partagé par les rendus du visage. Un flou SVG est un filtre ; on en crée UN par écart-type (clé arrondie
 * à 0,1 px), réutilisé par toutes les formes, sur une zone large (2 W × 2 H) pour ne jamais couper un halo. Les formes douces sont ce
 * qui donne des transitions sans arêtes entre zones éclairées et ombrées.
 */
export interface SoftKit {
  readonly defs: string[];
  /** Référence `url(#…)` du filtre de flou d'écart-type `sigma` (px). */
  blur(sigma: number): string;
  /** Trait flou le long de `d` (couleur, largeur, opacité). */
  stroke(d: string, color: string, width: number, opacity: number, sigma: number): string;
  /** Surface floue. */
  fill(d: string, fill: string, opacity: number, sigma: number): string;
}

export function softKit(id: string, W: number, H: number): SoftKit {
  const defs: string[] = [];
  const known = new Set<string>();
  const blur = (sigma: number): string => {
    const key = num(Math.max(0.1, Math.round(sigma * 10) / 10)).replace('.', '_');
    const fid = `${id}-blur-${key}`;
    if (!known.has(fid)) {
      known.add(fid);
      defs.push(el('filter', { id: fid, filterUnits: 'userSpaceOnUse', x: -W, y: -H, width: 2 * W, height: 3 * H, 'color-interpolation-filters': 'sRGB' }, [el('feGaussianBlur', { stdDeviation: Math.max(0.1, Math.round(sigma * 10) / 10) })]));
    }
    return urlRef(fid);
  };
  return {
    defs,
    blur,
    stroke: (d, color, width, opacity, sigma) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': opacity, filter: blur(sigma) }),
    fill: (d, fill, opacity, sigma) => el('path', { d, fill, 'fill-opacity': opacity, filter: blur(sigma) }),
  };
}

/** Chemin SVG d'une polyligne ouverte. */
export const lineD = (pts: readonly { x: number; y: number }[]): string => `M${pts.map((q) => `${num(q.x)} ${num(q.y)}`).join('L')}`;
