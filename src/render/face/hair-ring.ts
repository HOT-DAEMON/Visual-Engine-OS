import { clamp } from '../../core/math';
import { el, urlRef } from '../../core/svg';
import { peakShadeOpacity } from '../../core/shade';
import type { HairLockRing } from '../../face/hair';
import { gradientStop } from '../../materials';
import { polyPath } from './path';

/**
 * REFLET TRANSVERSAL d'une mèche dans le rendu PRINCIPAL (passe 8) : ce que le moteur de grammaire a calculé (`HairLock.geom.ring`, validé par `ringIsSane`) est ici DESSINÉ,
 * avec les couleurs et le réglage du moteur d'apparence (`ra`) — une seule apparence, pas une seconde peinture.
 *   - ombre aval : un `linearGradient` par segment, au profil mesuré (`hair-grammar/ring-shade.ts`), opacité de crête selon le ton du remplissage (`core/shade.ts`) ;
 *   - bande blanche : aplat de `ra.highlight`, opacité 0,55 + 0,4 × force, mise à l'échelle par `reflection.intensity` (0,5 = neutre, comme `hairGloss`).
 * Le tout est rogné par le contour de la mèche (clipPath fourni par l'appelant). Aucun import du moteur de grammaire : le contrat est le type `HairLockRing`.
 */
export interface RingPaint {
  /** Couleur de l'ombre (`ra.shadow`) et du reflet (`ra.highlight`). */
  readonly shadow: string; readonly highlight: string;
  /** Couleur de remplissage de la mèche à mi-longueur : la crête de l'ombre en dépend (creux relatif constant, mesuré). */
  readonly fill: string;
  /** `reflection.intensity` ∈ [0, 1]. */
  readonly intensity: number;
  /** Préfixe d'identifiant unique (par mèche) pour les dégradés. */
  readonly id: string;
  /** Vrai en ombrage cel : l'ombre est alors portée par les bandes cel (bords nets voulus), seul le reflet est dessiné. */
  readonly cel: boolean;
}

/**
 * Spline fermée de Catmull-Rom (tension 1/6) PASSANT par les points : le tracé exact du moteur de grammaire (`hair-grammar/blade.ts → smoothPath(pts, true)`), dont la garde de rendu a validé les sommets.
 * Recopiée ici (le rendu n'importe pas la grammaire) ; `tests/hair-engine-ring-shade.test.ts` impose l'égalité des deux tracés, pour qu'ils ne divergent jamais.
 * Pourquoi pas le `smoothPath` du rendu (quadratiques entre milieux d'arêtes) : il ne passe pas par les points et rétrécit la bande, ce qui la déformait en zigzag sur les polygones peu denses du reflet.
 */
export function ringPath(pts: readonly { x: number; y: number }[]): string {
  const n = pts.length; if (n < 2) return '';
  const at = (i: number): { x: number; y: number } => pts[((i % n) + n) % n] as { x: number; y: number }; const f = (v: number): string => (Math.round(v * 100) / 100).toString();
  let d = `M${f(at(0).x)} ${f(at(0).y)}`;
  for (let i = 0; i < n; i++) { const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2); d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`; }
  return `${d}Z`;
}

export function ringMarkup(r: HairLockRing, p: RingPaint): { defs: string[]; markup: string[] } {
  const defs: string[] = []; const markup: string[] = [];
  const peak = p.cel ? 0 : peakShadeOpacity(p.fill, p.shadow);
  if (peak > 0) {
    r.shade.forEach((s, j) => {
      const gid = `${p.id}-s${j}`;
      defs.push(el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: s.from.x, y1: s.from.y, x2: s.to.x, y2: s.to.y }, [gradientStop(0, p.shadow, peak * s.w0), gradientStop(1, p.shadow, peak * s.w1)]));
      markup.push(el('path', { d: polyPath(s.poly as never), fill: urlRef(gid) }));
    });
  }
  const gain = clamp(0.4 + 1.2 * p.intensity, 0, 1.6);
  markup.push(el('path', { d: ringPath(r.highlight), fill: p.highlight, opacity: clamp((0.55 + 0.4 * r.strength) * gain, 0, 0.95) }));
  return { defs, markup };
}
