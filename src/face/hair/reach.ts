import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle } from '../../schema';
import type { HairCtx } from './flow';
import { distanceOutsideSkull } from './thickness';

type Style = Exclude<HairStyle, 'bald'>;

/**
 * PORTÉE des formes libres (cônes, rubans en S, volutes) autour du crâne, par coiffure : une forme libre est une licence de style, pas une licence de
 * proportion. Une coupe rase n'a rien qui monte, des cheveux tirés (queue, chignon, tresses) ou longs et lourds ne portent ni cornes de 0,3 H ni
 * boucles qui partent à l'horizontale. Mesuré avant : 0,13 à 0,23 H de montée en v2 pour TOUTES les coiffures (classique : 0,00 à 0,14), et des
 * volutes latérales à plus de 0,5 W du contour. Les coiffures qui se dressent (hérissée, bouclée, afro) gardent une grande portée.
 *  - `up`   : montée maximale au-dessus du sommet du crâne (fraction de H) ;
 *  - `side` : éloignement maximal au contour du crâne, mesuré en distance réelle (fraction de W).
 */
export const REACH: Record<Style, { readonly up: number; readonly side: number }> = {
  buzz: { up: 0.03, side: 0.02 },
  short: { up: 0.1, side: 0.07 },
  spiky: { up: 0.2, side: 0.12 },
  curly: { up: 0.16, side: 0.2 },
  afro: { up: 0.32, side: 0.3 },
  bob: { up: 0.08, side: 0.07 },
  long: { up: 0.08, side: 0.07 },
  ponytail: { up: 0.08, side: 0.06 },
  bun: { up: 0.08, side: 0.06 },
  braids: { up: 0.08, side: 0.06 },
};
export const REACH_UP: Record<Style, number> = Object.fromEntries(Object.entries(REACH).map(([k, v]) => [k, v.up])) as Record<Style, number>;

/** Demi-largeur d'une mèche libre (marge de la borne, fraction de H / de W) : la borne s'applique à la ligne médiane, le bord de la mèche dépasse un peu. */
const HALF_WIDTH_H = 0.015;
const HALF_WIDTH_W = 0.012;

/**
 * Ramène une ligne médiane dans la portée de la coiffure : montée ≤ `up · H` et éloignement du crâne ≤ `side · W`. Le déplacement depuis
 * la racine est mis à l'échelle d'un seul facteur (la forme, l'enroulement et la courbure sont conservés ; seule la longueur diminue). La racine ne
 * bouge pas. Identité quand la mèche respecte déjà la portée. `halfWidth` (px) : demi-largeur de la forme, comptée dans les bornes. `lateral = 'cranial'` : l'éloignement n'est borné qu'au-dessus de la tempe (mèches de corps : leur chute le long du visage et du cou est légitime, leur envol sur le crâne ne l'est pas) ; `false` : seule la montée est bornée.
 */
export function fitReach(ctx: HairCtx, c: Vec[], halfWidth = 0, lateral: boolean | 'cranial' = true): Vec[] {
  const R = c[0];
  if (!R) return c;
  const style = ctx.h.style as Style;
  const S = ctx.boundary.skull;
  const upAllowed = Math.max(0, REACH[style].up * ctx.lm.H - Math.max(HALF_WIDTH_H * ctx.lm.H, halfWidth));
  // Latéral : la demi-largeur RÉELLE de la forme (ruban large, base de cône) remplace la marge fixe quand elle est plus grande.
  const sideAllowed = Math.max(0, REACH[style].side * ctx.lm.W - Math.max(HALF_WIDTH_W * ctx.lm.W, halfWidth));
  let f = 1;
  // Montée : topY − (R.y + f·dy) ≤ allowed  ⇒  f ≤ (allowed + R.y − topY) / (−dy).
  for (const p of c) {
    const dy = p.y - R.y;
    if (dy < 0) f = Math.min(f, Math.max(0, (upAllowed + R.y - S.topY) / -dy));
  }
  // Écart au crâne : DISTANCE RÉELLE au contour (pas l'écart horizontal à a(y), nul au-dessus du sommet), au plus `side · W` moins la demi-largeur de la forme.
  // Le budget ne tombe jamais sous la distance de la racine + 0,02 W : une racine déjà dans la coque ne fait pas s'effondrer la forme.
  // Quelques passes de point fixe : la distance varie avec le facteur d'échelle de façon quasi proportionnelle.
  const dRoot = lateral ? distanceOutsideSkull(S, R, 96) : 0;
  const cranialY = ctx.lm.hair.sideY;
  const budget = Math.max(sideAllowed, dRoot + 0.02 * ctx.lm.W);
  for (let pass = 0; pass < (lateral ? 4 : 0); pass++) {
    for (const p of c) {
      if (lateral === 'cranial' && p.y > cranialY) continue;
      const qx = R.x + (p.x - R.x) * f, qy = R.y + (p.y - R.y) * f;
      const over = distanceOutsideSkull(S, { x: qx, y: qy }, 96) - budget;
      const run = Math.hypot(qx - R.x, qy - R.y);
      if (over > 1e-6 && run > 1e-6) f = Math.max(0, f * Math.max(0, 1 - over / run));
    }
  }
  return f >= 1 ? c : c.map((p) => ({ x: R.x + (p.x - R.x) * f, y: R.y + (p.y - R.y) * f }));
}
