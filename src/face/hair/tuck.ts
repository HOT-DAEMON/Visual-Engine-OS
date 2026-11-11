import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle } from '../../schema';
import type { Poly } from '../poly';
import type { SkullSurface } from './boundary/skull-surface';
import { gridOver, indexAt, paint } from './coverage';
import { distanceOutsideSkull } from './thickness';
import type { HairLock } from './types';

type Style = Exclude<HairStyle, 'bald'>;

/**
 * RENTRAGE DE LA SOUS-COUCHE (`docs/HAIR-DOME-ROUND.md`) : la coque est dessinée sous les mèches ; là où aucune mèche n'arrive jusqu'à son bord, sa teinte de racine (sombre) dépasse
 * en CROISSANT hors des mèches (afro violet des planches : croissant noir sur le flanc). Le rognage des mèches sur la coque ne remplit pas la coque (`HAIR-ROUND-REMAINING.md` 3).
 * Remède : chaque sommet du bord EXTÉRIEUR de la coque est ramené vers le centre du crâne jusqu'à la première cellule couverte par une mèche (au plus `maxInset` × W), puis le déplacement
 * est lissé le long de l'anneau. La lisière (implantation, pattes, arche de l'oreille) et les sommets proches du crâne ne bougent pas ; il reste toujours au moins 40 % de l'épaisseur.
 *  - `maxInset` : retrait maximal (fraction de W).
 */
export const TUCK: Partial<Record<Style, { readonly maxInset: number }>> = {
  afro: { maxInset: 0.05 },
};

/** Pas de la grille (fraction de W) : plus fin que la grille de couverture du remplissage (0,012). */
const CELL = 0.008;
/** Sommets plus proches du crâne que cette part de l'épaisseur maximale : lisière, hors bord extérieur. */
const OUTER_FROM = 0.4;
const SMOOTH_PASSES = 4;

/** Anneau `base` dont le bord extérieur est rentré sur les mèches `locks` ; le MÊME objet si rien ne bouge. */
export function tuckBase(base: Poly, S: SkullSurface, W: number, C: Vec, locks: readonly HairLock[], maxInset: number): Poly {
  const g = gridOver(base, CELL * W), cover = new Uint8Array(g.nx * g.ny);
  for (const l of locks) if (l.layer === 'front' && l.kind !== 'wisp') paint(g, l.poly, cover);
  const dist = base.map((v) => distanceOutsideSkull(S, v, 60));
  const thick = dist.reduce((m, d) => Math.max(m, d), 1e-6);
  const steps = Math.ceil((maxInset * W) / g.cell);
  const dirs: Vec[] = [];
  let inset = base.map((v, i) => {
    const dx = C.x - v.x, dy = C.y - v.y, n = Math.hypot(dx, dy) || 1;
    dirs[i] = { x: dx / n, y: dy / n };
    if ((dist[i] as number) < OUTER_FROM * thick) return 0;
    for (let k = 0; k <= steps; k++) {
      const ix = indexAt(g, v.x + (dirs[i] as Vec).x * k * g.cell, v.y + (dirs[i] as Vec).y * k * g.cell);
      if (ix < 0) break;
      if (cover[ix]) return k === 0 ? 0 : (k - 1) * g.cell;
    }
    return steps * g.cell;
  });
  if (inset.every((d) => d <= 1e-6)) return base;
  for (let p = 0; p < SMOOTH_PASSES; p++) inset = inset.map((d, i) => 0.25 * (inset[(i + inset.length - 1) % inset.length] as number) + 0.5 * d + 0.25 * (inset[(i + 1) % inset.length] as number));
  return base.map((v, i) => {
    const d = Math.min(inset[i] as number, maxInset * W, 0.6 * (dist[i] as number));
    return d <= 1e-6 ? v : { x: v.x + (dirs[i] as Vec).x * d, y: v.y + (dirs[i] as Vec).y * d };
  });
}

/**
 * Part des sommets du bord extérieur de la coque `base` dont la cellule couverte par une mèche la plus proche, en allant vers le centre du crâne, est à plus de `probe` × W (ou absente) :
 * 0 = la coque ne dépasse jamais des mèches ; mesure unique du rentrage ET de la vérification (`verify/hair-dome.ts`).
 */
export function rimGap(base: Poly, S: SkullSurface, W: number, C: Vec, locks: readonly HairLock[], probe: number): number {
  const g = gridOver(base, CELL * W), cover = new Uint8Array(g.nx * g.ny);
  for (const l of locks) if (l.layer === 'front' && l.kind !== 'wisp') paint(g, l.poly, cover);
  const dist = base.map((v) => distanceOutsideSkull(S, v, 60));
  const thick = dist.reduce((m, d) => Math.max(m, d), 1e-6);
  const steps = Math.ceil((probe * W) / g.cell);
  let outer = 0, gap = 0;
  base.forEach((v, i) => {
    if ((dist[i] as number) < OUTER_FROM * thick) return;
    outer++;
    const dx = C.x - v.x, dy = C.y - v.y, n = Math.hypot(dx, dy) || 1;
    for (let k = 0; k <= steps; k++) {
      const ix = indexAt(g, v.x + (dx / n) * k * g.cell, v.y + (dy / n) * k * g.cell);
      if (ix >= 0 && cover[ix]) return;
    }
    gap++;
  });
  return outer ? gap / outer : 0;
}
