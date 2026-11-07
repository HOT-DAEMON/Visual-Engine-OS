import { clamp } from '../../core/math';
import { el, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face/landmarks';
import type { Poly } from '../../face/poly';
import { gradientStop as stop } from '../../materials';

/**
 * Dégradé d'opacité de la MASSE ARRIÈRE : pleine derrière la tête (elle y remplace le fond entre les mèches), elle fond dans une bande ÉTROITE autour de la
 * mâchoire, puis disparaît : sous le cou on ne voit que des mèches. Deux défauts mesurés sur les coiffures longues : un bord inférieur net faisait un
 * « bavoir » sombre à fond arrondi, plus large et plus profond que les mèches ; un estompage long laissait une tache de fumée grise sous le cou
 * (aplat sombre translucide sur fond clair). Les mèches arrière sont dessinées PAR-DESSUS : leurs pointes dépassent librement.
 *  - `before` : l'estompage commence `before · H` au-dessus de la mâchoire (encore cachée par le visage) ;
 *  - `after`  : la masse a disparu `after · H` sous la mâchoire.
 */
export const BACK_FADE = { before: 0.04, after: 0.1 } as const;

export function backMassFill(id: string, poly: Poly, lm: FaceLandmarks, color: string): { fill: string; def: string } {
  let y0 = Infinity, y1 = -Infinity;
  for (const q of poly) { if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
  const span = Math.max(1e-6, y1 - y0);
  const end = Math.min(y1, lm.jawY + BACK_FADE.after * lm.H);
  // Masse courte (finie vers la mâchoire) : l'estompage prend au plus le quart inférieur de la masse.
  const start = clamp(Math.min(lm.jawY - BACK_FADE.before * lm.H, end - 0.25 * span), y0, end - 1e-3);
  const at = (t: number): number => clamp((start + (end - start) * t - y0) / span, 0, 1);
  const def = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: y0, x2: 0, y2: y1 }, [
    stop(0, color, 1),
    stop(at(0), color, 1),
    stop(at(0.5), color, 0.4),
    stop(at(1), color, 0),
    stop(1, color, 0),
  ]);
  return { fill: urlRef(id), def };
}
