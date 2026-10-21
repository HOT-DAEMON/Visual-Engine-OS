import { el } from '../../../core/svg';
import type { ResolvedAppearance } from '../../../appearance';
import type { Blob } from '../../../face/structure';
import { direction2D, type LightVector } from '../../../lighting/light';
import { intensityFor } from '../../../lighting/rig';
import type { FaceParams } from '../../../schema';
import { softKit, type SoftKit } from '../soft';

/**
 * Contexte commun des calques de structure : tout ce qu'un calque lit pour peindre, calculé UNE fois (échelle, lumière, filtres, facteurs de style).
 * Les facteurs de style (`soft`, `detail`) viennent du PROFIL de stylisation et du MODE de rendu : ils règlent la manière de peindre, jamais la géométrie.
 */
export interface StructureCtx {
  readonly id: string;
  readonly p: FaceParams;
  readonly ra: ResolvedAppearance;
  readonly L: LightVector;
  readonly kit: SoftKit;
  /** Unité de longueur (W / 300). */
  readonly u: number;
  /** Direction 2D vers la lumière (x > 0 : lumière à droite de l'image). */
  readonly dir: { readonly x: number; readonly y: number };
  /** Intensité de la lumière sur la peau (0–1+). */
  readonly I: number;
  /** Facteur de douceur des transitions : 1 = fondues ; ↓ avec `simplify` et en rendu `anime` (bords quasi nets). */
  readonly soft: number;
  /** Niveau de détail anatomique (0–1) : multiplie l'opacité des détails fins (plis, relief du masséter, creux). */
  readonly detail: number;
}

export function structureCtx(id: string, p: FaceParams, W: number, H: number, ra: ResolvedAppearance, L: LightVector): StructureCtx {
  const anime = p.renderMode === 'anime';
  return {
    id,
    p,
    ra,
    L,
    kit: softKit(`${id}-st`, W, H),
    u: W / 300,
    dir: direction2D(L),
    I: intensityFor(L, 'skin'),
    soft: (anime ? 0.15 : 1) * (1 - 0.7 * p.stylization.simplify),
    detail: p.stylization.detail,
  };
}

/** Ellipse orientée et floue (un volume mou) ; `sigma` en px, déjà multiplié par le facteur de douceur par l'appelant. */
export function blobEl(c: StructureCtx, b: Blob, fill: string, opacity: number, sigma: number): string {
  if (opacity <= 0.004) return '';
  return el('ellipse', { cx: b.c.x, cy: b.c.y, rx: Math.max(0.5, b.rx), ry: Math.max(0.5, b.ry), transform: b.rotDeg === 0 ? undefined : `rotate(${b.rotDeg} ${b.c.x} ${b.c.y})`, fill, 'fill-opacity': opacity, filter: c.kit.blur(Math.max(0.1, sigma * c.soft)) });
}

/** `true` si un point (x) est du côté éclairé de la tête (lumière à droite → côté droit éclairé). */
export const litSide = (c: StructureCtx, x: number): boolean => x * c.dir.x >= 0;
