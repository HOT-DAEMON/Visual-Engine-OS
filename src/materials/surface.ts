import { clamp01 } from '../core/math';
import { el } from '../core/svg';
import type { ColorSource } from '../schema';

/**
 * Interface générique d'une géométrie habillable par le système de matériaux (voir
 * compile-surface.ts). Un objet (œil, robot, panneau…) ne fournit que sa forme ; la couleur, la
 * lumière et l'ombrage viennent du système de matériaux, jamais de l'objet lui-même.
 */
export interface BBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Géométrie d'un objet vue par le système de matériaux. */
export interface Surface {
  readonly bbox: BBox;
  /** 'sphere' : surface bombée (ombrage radial, reflet ponctuel). 'flat' : plane (ombrage linéaire, bande de reflet). */
  readonly curvature: 'sphere' | 'flat';
  /** Dessine la géométrie avec les attributs de peinture fournis. */
  draw(attrs: import('../core/svg').Attrs): string;
}

export interface CompiledSurface {
  readonly defs: string[];
  readonly markup: string;
}

/** Un `<stop>` de dégradé SVG, avec décalage et opacité bornés à [0, 1]. */
export const gradientStop = (offset: number, color: string, opacity = 1): string =>
  el('stop', { offset: clamp01(offset), 'stop-color': color, 'stop-opacity': clamp01(opacity) });

/** Couleur « représentative » : la couleur unie, ou le stop central d'un dégradé. */
export function dominantColor(src: ColorSource): string {
  if (src.type === 'solid') return src.color;
  const mid = src.stops[Math.floor((src.stops.length - 1) / 2)];
  return (mid ?? src.stops[0])?.color ?? '#808080';
}

/** Couleur de bord : la couleur unie, ou le dernier stop d'un dégradé. */
export function edgeColor(src: ColorSource): string {
  if (src.type === 'solid') return src.color;
  return src.stops[src.stops.length - 1]?.color ?? '#000000';
}

/** Tache lumineuse : pleine jusqu'à (1 - softness), puis fondu jusqu'à transparent au bord. */
export function spotGradient(id: string, color: string, alpha: number, softness: number): string {
  return el('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5 }, [
    gradientStop(0, color, alpha),
    gradientStop(1 - softness, color, alpha),
    gradientStop(1, color, 0),
  ]);
}
