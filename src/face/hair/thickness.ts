import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle } from '../../schema';
import type { SkullSurface } from './boundary/skull-surface';

/**
 * ÉPAISSEUR DES CHEVEUX AU-DESSUS DU CRÂNE, par coiffure (fractions de W) — borne anatomique de la coque (`scalp.ts`) et de la longueur des mèches.
 *  - `cap`  : épaisseur maximale de la coque. Cheveux tirés en arrière (queue, chignon, tresses) = presque plaqués au crâne ; coupes courtes = 1 à 2 cm
 *    sur un crâne de ≈ 23 cm ; longs lisses = poids qui tasse ; bouclé et crépu = vrai volume.
 *  - `puff` : part du gonflement `silhouette.puff` que la coiffure admet (0 = aucune). Le gonflement épaissit la coque ET allonge les mèches
 *    (`flow.ts`) : sans cette part, une queue de cheval tirée recevait le volume d'un afro (dôme de 0,05–0,07 H mesuré, max 0,11 H).
 * Le plafond est un GENOU DOUX : identité jusqu'à 70 % de `cap`, saturation exponentielle au-delà. Les valeurs du moteur classique (≤ 0,9 `cap`) bougent
 * donc de moins de 3 % ; seuls les tirages gonflés du moteur v2 sont ramenés dans la plage anatomique.
 */
export const THICKNESS: Record<Exclude<HairStyle, 'bald'>, { readonly cap: number; readonly puff: number }> = {
  buzz: { cap: 0.01, puff: 0 },
  short: { cap: 0.045, puff: 0.4 },
  spiky: { cap: 0.05, puff: 0.5 },
  curly: { cap: 0.16, puff: 1 },
  afro: { cap: 0.32, puff: 1 },
  bob: { cap: 0.06, puff: 0.35 },
  long: { cap: 0.06, puff: 0.3 },
  ponytail: { cap: 0.035, puff: 0.12 },
  bun: { cap: 0.035, puff: 0.12 },
  braids: { cap: 0.035, puff: 0.12 },
};

const KNEE = 0.7;

/** Épaisseur de coque effective (fraction de W) pour une demande `raw` : identité sous le genou, saturation vers `cap` au-dessus. */
export function shellThickness(style: Exclude<HairStyle, 'bald'>, raw: number): number {
  const { cap } = THICKNESS[style];
  const k = KNEE * cap;
  if (raw <= k) return raw;
  const room = cap - k;
  return k + room * (1 - Math.exp(-(raw - k) / room));
}

/**
 * Épaisseur maximale APRÈS gain d'asymétrie (fraction de `cap`) : un balayage peut gonfler un côté de 35 %, pas le doubler. Le gain de silhouette
 * monte jusqu'à ×2,1 (`makeGain`) : sans cette borne, une coque d'afro ou de bouclé était deux fois plus épaisse d'un seul côté.
 */
export const GAIN_LIMIT = 1.35;

/**
 * ÉCART MAXIMAL du gain d'asymétrie à 1 (`docs/HAIR-ROUND.md`), par coiffure. Afro et bouclé sont des MASSES RONDES centrées sur le crâne : un gain de 0,35 à 2,1
 * (balayage de silhouette) faisait un dôme penché, épais d'un côté et mince de l'autre (mesuré : écart de demi-largeur de la coque 11 % en médiane, 22,5 % au p90 sur
 * 40 afros ; part nue des deux moitiés différente jusqu'à 0,30). Ces deux coiffures ne gardent qu'un souffle d'asymétrie ; les autres coiffures sont inchangées.
 */
export const GAIN_SPAN: Partial<Record<Exclude<HairStyle, 'bald'>, number>> = { afro: 0.06, curly: 0.1 };

/** Gain d'asymétrie borné par la coiffure (identité pour les coiffures sans entrée dans `GAIN_SPAN`). */
export function boundGain(gain: (s: number) => number, style: Exclude<HairStyle, 'bald'>): (s: number) => number {
  const span = GAIN_SPAN[style];
  if (span === undefined) return gain;
  return (s) => Math.min(1 + span, Math.max(1 - span, gain(s)));
}

/** Épaisseur maximale absolue de la coque (px) d'une coiffure, gain compris. */
export const maxShell = (style: Exclude<HairStyle, 'bald'>, W: number): number => THICKNESS[style].cap * GAIN_LIMIT * W;

/** Ramène un point dans le volume admis autour du crâne : largeur ≤ a(y) + épaisseur maximale, hauteur ≤ sommet + épaisseur maximale. */
export function withinShell(style: Exclude<HairStyle, 'bald'>, S: SkullSurface, W: number, q: Vec): Vec {
  const m = maxShell(style, W);
  const lim = S.a(q.y) + m;
  return { x: Math.sign(q.x) * Math.min(Math.abs(q.x), lim), y: Math.max(q.y, S.topY - m) };
}

/**
 * Distance d'un point à l'EXTÉRIEUR du crâne (0 s'il est dedans) : plus courte distance au contour du crâne (demi-largeur `a(y)` de chaque côté, de
 * sommet à menton), échantillonné finement. C'est la vraie épaisseur normale des cheveux ; l'écart horizontal à `a(y)` ne l'est pas : près du
 * sommet, le contour est presque horizontal et une coque normale paraît « large » de plusieurs centimètres.
 */
export function distanceOutsideSkull(S: SkullSurface, q: Vec, samples = 260): number {
  if (q.y >= S.topY && Math.abs(q.x) <= S.a(q.y)) return 0;
  // Échantillonnage en u² : dense au sommet, où a(y) croît en racine et où le contour est presque horizontal (un pas uniforme en y le sauterait).
  const span = S.chinY - S.topY;
  const px = Math.abs(q.x);
  let best = Infinity, ax = 0, ay = S.topY;
  for (let i = 1; i <= samples; i++) {
    const u = i / samples, bx = S.a(S.topY + span * u * u), by = S.topY + span * u * u;
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (q.y - ay) * vy) / L2));
    const d = Math.hypot(px - (ax + t * vx), q.y - (ay + t * vy));
    if (d < best) best = d;
    ax = bx; ay = by;
  }
  return best;
}
