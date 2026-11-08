import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle } from '../../schema';
import type { SkullSurface } from './boundary/skull-surface';
import type { Poly } from '../poly';
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
  const cranialY = cranialLimit(ctx);
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

/** Mode de borne d'une mèche : `true` = montée ET éloignement du crâne ; `'cranial'` = éloignement borné seulement au-dessus de la tempe (la chute le long du visage reste libre). */
export type ReachMode = true | 'cranial';

/** Marge de sécurité du ré-échantillonnage (96 segments) face à la mesure fine de la vérification (260) : la forme est ramenée un peu en deçà de la limite. */
const SAFE = 0.985;

/** Budget de la coiffure en pixels : éloignement maximal au contour du crâne (distance réelle) et ordonnée la plus haute admise. Source unique : construction ET vérification. */
export function reachBudget(style: Style, S: SkullSurface, W: number, H: number): { readonly side: number; readonly yTop: number } {
  return { side: REACH[style].side * W * SAFE, yTop: S.topY - REACH[style].up * H * SAFE };
}

/**
 * Ordonnée sous laquelle l'éloignement n'est plus borné en mode `cranial` : la tempe pour les coiffures PENDANTES (bob, long : leur chute le long du visage
 * et du cou est légitime), aucune limite pour les autres (coupes courtes, bouclées, afro, attachées) : un fil horizontal de 0,25 W à hauteur de tempe
 * sur une coupe courte n'est pas une chute, c'est une mèche qui s'envole.
 */
export const cranialLimit = (ctx: HairCtx): number => (ctx.def.hang ? ctx.lm.hair.sideY : Infinity);

/** Contour du crâne échantillonné UNE fois par surface (96 segments en u², dense au sommet) : `a(y)` fouille le contour du visage, trop cher à rappeler par sommet. */
const CONTOUR = new WeakMap<SkullSurface, { readonly xs: Float64Array; readonly ys: Float64Array }>();
function contourOf(S: SkullSurface): { readonly xs: Float64Array; readonly ys: Float64Array } {
  const hit = CONTOUR.get(S);
  if (hit) return hit;
  const n = 96, span = S.chinY - S.topY, xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
  ys[0] = S.topY;
  for (let i = 1; i <= n; i++) { const y = S.topY + span * (i / n) ** 2; ys[i] = y; xs[i] = S.a(y); }
  const c = { xs, ys };
  CONTOUR.set(S, c);
  return c;
}

/** Distance à l'extérieur du crâne (même définition que `distanceOutsideSkull`, 96 segments) sur le contour mis en cache. */
function distOut(S: SkullSurface, q: Vec): number {
  const { xs, ys } = contourOf(S), px = Math.abs(q.x);
  let best = Infinity;
  for (let i = 1; i < xs.length; i++) {
    const ax = xs[i - 1] as number, ay = ys[i - 1] as number, vx = (xs[i] as number) - ax, vy = (ys[i] as number) - ay, L2 = vx * vx + vy * vy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (q.y - ay) * vy) / L2));
    const d = Math.hypot(px - (ax + t * vx), q.y - (ay + t * vy));
    if (d < best) best = d;
  }
  return best;
}

/** Un point respecte-t-il la portée ? Rejets et acceptations exacts et bon marché d'abord (au-dessus du sommet, écart horizontal sous le sommet), puis la mesure fine. */
export function inReach(S: SkullSurface, q: Vec, side: number, yTop: number, cranialY: number, mode: ReachMode): boolean {
  if (q.y < yTop) return false;
  if (mode === 'cranial' && q.y > cranialY) return true;
  if (q.y >= S.topY) {
    const a = S.a(q.y), px = Math.abs(q.x);
    if (px <= a) return true;
    if (px - a <= side) return true;
  } else {
    // Au-dessus du sommet : le point le plus haut du crâne (0, topY) majore la distance ; la distance verticale au sommet la minore.
    const dy = S.topY - q.y;
    if (dy > side) return false;
    if (Math.hypot(q.x, dy) <= side) return true;
  }
  return distOut(S, q) <= side;
}

/** Ramène `v` vers `anchor` (qui respecte la portée) jusqu'à la frontière, par dichotomie : l'écart est supprimé, la direction conservée. */
function pullIn(S: SkullSurface, v: Vec, anchor: Vec, side: number, yTop: number, cranialY: number, mode: ReachMode): Vec {
  let lo = 0, hi = 1;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    if (inReach(S, { x: anchor.x + (v.x - anchor.x) * mid, y: anchor.y + (v.y - anchor.y) * mid }, side, yTop, cranialY, mode)) lo = mid;
    else hi = mid;
  }
  return { x: anchor.x + (v.x - anchor.x) * lo, y: anchor.y + (v.y - anchor.y) * lo };
}

/**
 * Borne de l'ENVELOPPE RÉELLE d'une mèche (`docs/HAIR-REACH-POLY.md`). `fitReach` ne borne que la ligne médiane, avec une demi-largeur supposée : or la
 * largeur finale est multipliée par la texture (`spec.wide`) et par le gain de silhouette, et l'ondulation déplace encore l'axe APRÈS la borne. Mesuré
 * avant : un ruban `mass` de coupe courte à 0,336 W du crâne pour une portée de 0,07 W (axe à 0). Ici l'axe est d'abord ramené (racine fixe, de proche en
 * proche), puis chaque sommet du polygone qui sort est ramené vers son point d'axe le plus proche : la mèche s'affine au lieu de disparaître.
 */
export function conformReach(ctx: HairCtx, spine: Vec[], poly: Poly, mode: ReachMode): { spine: Vec[]; poly: Poly } {
  const style = ctx.h.style as Style, S = ctx.boundary.skull;
  const { side, yTop } = reachBudget(style, S, ctx.lm.W, ctx.lm.H);
  const cy = cranialLimit(ctx);
  const ok = (q: Vec): boolean => inReach(S, q, side, yTop, cy, mode);
  let sp = spine;
  if (spine.some((q, i) => i > 0 && !ok(q))) {
    sp = [...spine];
    for (let i = 1; i < sp.length; i++) if (!ok(sp[i] as Vec)) sp[i] = pullIn(S, sp[i] as Vec, sp[i - 1] as Vec, side, yTop, cy, mode);
  }
  let out = poly;
  for (let k = 0; k < poly.length; k++) {
    const v = poly[k] as Vec;
    if (ok(v)) continue;
    if (out === poly) out = [...poly];
    let a = sp[0] as Vec, best = Infinity;
    for (const q of sp) { const d = (q.x - v.x) ** 2 + (q.y - v.y) ** 2; if (d < best) { best = d; a = q; } }
    out[k] = ok(a) ? pullIn(S, v, a, side, yTop, cy, mode) : a;
  }
  return { spine: sp, poly: out };
}

/**
 * Portée sous VENT (`docs/HAIR-WIND-REACH.md`) : un sommet déplacé par le vent peut dépasser la portée de repos d'une tolérance proportionnelle à la
 * force (`power = |vent| · flex`) : `+0,10 W` d'éloignement et `+0,08 H` de montée à pleine force. `ok(v)` dit si le sommet respectait la portée AU REPOS
 * (sinon il est hors borne par construction — queue, tresse, chute — et le vent ne le contraint pas) ; `allowed(p)` dit si sa position déplacée reste admise.
 */
export function windReach(style: Style, S: SkullSurface, W: number, H: number, cranialY: number, power: number): { ok(v: Vec): boolean; allowed(p: Vec): boolean } {
  const b = reachBudget(style, S, W, H);
  const p = Math.min(1, power);
  return {
    ok: (v) => inReach(S, v, b.side, b.yTop, cranialY, 'cranial'),
    allowed: (q) => inReach(S, q, b.side + 0.1 * W * p, b.yTop - 0.08 * H * p, cranialY, 'cranial'),
  };
}
