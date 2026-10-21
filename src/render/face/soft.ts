import { el, num, urlRef } from '../../core/svg';
import { pathBox, padBox, type Box } from '../../core/pathbox';

/**
 * Kit de formes DOUCES (flou) partagé par les rendus du visage. Un flou SVG est un filtre ; les formes douces donnent des transitions
 * sans arêtes entre zones éclairées et ombrées.
 *
 * COÛT (mesuré, docs/PERF.md) : la rastérisation d'un filtre est proportionnelle à l'AIRE de sa région. Un filtre de 2 W × 3 H sur un
 * trait de nez de 2 % de la tête coûtait ~50× trop. La région d'un flou est donc la boîte de l'élément (calculée à partir de son
 * chemin ou fournie par l'appelant) élargie de `BLUR_REACH·σ` (+ demi-largeur du trait), arrondie vers l'extérieur sur une grille.
 * Contrat de fidélité : à `BLUR_REACH = 3.5` l'écart avec la région large est < 1/255 par canal (testé : tests/perf-filter-region.test.ts).
 * Deux éléments dont (σ, région arrondie) coïncident PARTAGENT le même `<filter>` (mutualisation, pas de doublon dans `defs`).
 */
export const BLUR_REACH = 3.5;
/** Pas de la grille d'arrondi des régions (px, repère local). Plus grand = plus de partage, plus petit = régions plus serrées. */
const SNAP = 6;

export interface SoftKit {
  readonly defs: string[];
  /** Référence `url(#…)` du filtre de flou d'écart-type `sigma` (px). Sans `box`, région LARGE historique (sûre, lente). */
  blur(sigma: number, box?: Box): string;
  /** Trait flou le long de `d` (couleur, largeur, opacité). */
  stroke(d: string, color: string, width: number, opacity: number, sigma: number): string;
  /** Surface floue. */
  fill(d: string, fill: string, opacity: number, sigma: number): string;
  /** Nombre de filtres distincts créés et nombre de références servies (mesure de la mutualisation). */
  readonly stats: { filters: number; refs: number };
}

export function softKit(id: string, W: number, H: number): SoftKit {
  const defs: string[] = [];
  const known = new Set<string>();
  const stats = { filters: 0, refs: 0 };
  const snapDown = (v: number): number => Math.floor(v / SNAP) * SNAP;
  const snapUp = (v: number): number => Math.ceil(v / SNAP) * SNAP;
  const blur = (sigma: number, box?: Box): string => {
    const s = Math.max(0.1, Math.round(sigma * 10) / 10);
    const key = num(s).replace('.', '_');
    stats.refs++;
    let region = { x: -W, y: -H, w: 2 * W, h: 3 * H }; // région large historique (repli)
    let fid = `${id}-blur-${key}`;
    if (box) {
      const p = padBox(box, BLUR_REACH * s);
      const x0 = snapDown(p.x); const y0 = snapDown(p.y);
      region = { x: x0, y: y0, w: snapUp(p.x + p.w) - x0, h: snapUp(p.y + p.h) - y0 };
      // Clé d'identité : (σ, région arrondie). Le signe moins devient `m` pour rester un identifiant SVG lisible.
      const q = (v: number): string => String(v).replace('-', 'm');
      fid = `${id}-blur-${key}-${q(region.x)}_${q(region.y)}_${q(region.w)}_${q(region.h)}`;
    }
    if (!known.has(fid)) {
      known.add(fid);
      stats.filters++;
      defs.push(el('filter', { id: fid, filterUnits: 'userSpaceOnUse', x: region.x, y: region.y, width: region.w, height: region.h, 'color-interpolation-filters': 'sRGB' }, [el('feGaussianBlur', { stdDeviation: s })]));
    }
    return urlRef(fid);
  };
  return {
    defs,
    blur,
    stats,
    stroke: (d, color, width, opacity, sigma) => {
      const b = pathBox(d);
      // Le trait déborde le chemin de la moitié de sa largeur (capuchons ronds) : on l'ajoute à la boîte.
      return el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': opacity, filter: blur(sigma, b ? padBox(b, width / 2 + 1) : undefined) });
    },
    fill: (d, fill, opacity, sigma) => {
      const b = pathBox(d);
      return el('path', { d, fill, 'fill-opacity': opacity, filter: blur(sigma, b ?? undefined) });
    },
  };
}

/** Chemin SVG d'une polyligne ouverte. */
export const lineD = (pts: readonly { x: number; y: number }[]): string => `M${pts.map((q) => `${num(q.x)} ${num(q.y)}`).join('L')}`;
