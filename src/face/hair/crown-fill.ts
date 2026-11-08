import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle } from '../../schema';
import type { Poly } from '../poly';
import type { SkullSurface } from './boundary/skull-surface';
import { centerOf, gridOver, indexAt, paint, type Grid } from './coverage';
import { growLock, lockFrom, type HairCtx } from './flow';
import { bareScalp } from './scalp';
import { inPoly } from '../poly';
import { distanceOutsideSkull } from './thickness';
import type { HairLock } from './types';

type Style = Exclude<HairStyle, 'bald'>;

/**
 * REMPLISSAGE DE LA COQUE (`docs/HAIR-FORM.md`) : la sous-couche racine est la coque de la chevelure, MAIS ce sont les mèches qui doivent dessiner le dôme.
 * Mesuré avant (8 visages par coiffure) : la moitié extérieure de la coque était NUE à 74 % pour l'afro (max 0,89), 58 % pour le bouclé, 62 % pour la coupe
 * courte, 79 % pour le bob : les mèches ne formaient qu'une bande le long de l'implantation et des côtés ; le dessus du dôme était un casque lisse dont
 * le bord faisait la silhouette (aucune texture de cheveu sur 0,25 H de montée).
 *
 * Remède : pour les coiffures qui ont du volume ou une silhouette de mèches, des mèches du style local (même champ de direction, même texture, même
 * largeur que les mèches de corps) sont enracinées dans les cellules NUES de la coque, de l'extérieur vers l'intérieur, jusqu'à ce que la part nue
 * repasse sous le seuil du style. Chaque mèche est rognée au bord de la coque : elle texture le contour sans le dépasser, et reste bornée par la portée de la coiffure.
 * Les coiffures tirées (queue, chignon, tresses) et la coupe rase restent des aplats lisses : c'est leur anatomie (cheveux plaqués, ras).
 */
export interface FillSpec {
  /** Part nue maximale tolérée sur la moitié EXTÉRIEURE de la coque (le bord, qui fait la silhouette). */
  readonly rim: number;
  /** Part nue maximale tolérée sur toute la coque. */
  readonly all: number;
  /** Longueur d'une mèche de remplissage (fraction de H). */
  readonly len: number;
  /** Nombre maximal de MÈCHES ajoutées (une mèche tressée est plusieurs formes) : un plafond de sécurité, pas une cible (la boucle s'arrête dès que les seuils sont tenus). Mesuré : à 20, une coupe courte à texture tressée (mèches en segments minces) restait à 0,77 de bord nu ; à 80, 0,36. */
  readonly max: number;
}

export const FILL: Partial<Record<Style, FillSpec>> = {
  short: { rim: 0.4, all: 0.45, len: 0.07, max: 80 },
  spiky: { rim: 0.4, all: 0.45, len: 0.09, max: 80 },
  curly: { rim: 0.25, all: 0.3, len: 0.12, max: 110 },
  afro: { rim: 0.2, all: 0.25, len: 0.16, max: 140 },
  bob: { rim: 0.3, all: 0.35, len: 0.12, max: 60 },
  long: { rim: 0.3, all: 0.35, len: 0.12, max: 60 },
};

/**
 * Fraction de la coque qui DOIT porter des cheveux : l'éclaircissement (`thinning`) laisse voir le crâne, le remplissage ne peut pas le recouvrir.
 * La densité n'y entre PAS : elle règle déjà le nombre de mèches de corps, et la sous-couche racine reste pleine (essayé : l'inclure rendait presque tout le gain,
 * bord nu de l'afro 0,26 → 0,45). Source unique : construction ET vérification.
 */
export const fillKeep = (h: { readonly thinning: number }): number => 1 - 0.5 * h.thinning;

/** Part nue tolérée quand la cible `bare` (à pleine densité) est relâchée par la rétention `keep`. */
export const relaxedBare = (bare: number, keep: number): number => 1 - (1 - bare) * keep;

/** Pas de la grille de couverture (fraction de W) et début de la « moitié extérieure » (fraction de l'épaisseur maximale de la coque). Source unique : construction ET vérification. */
export const COVER_CELL = 0.012;
export const RIM_FROM = 0.5;

/** Épaisseur maximale réelle de la coque (px) : plus grande distance d'un sommet de la coque à l'extérieur du crâne. */
export function ringThickness(S: SkullSurface, base: Poly): number {
  let m = 0;
  for (const q of base) m = Math.max(m, distanceOutsideSkull(S, q, 120));
  return Math.max(1, m);
}

export interface ShellCoverage {
  /** Part de la coque non couverte par une mèche. */
  readonly all: number;
  /** Part non couverte de sa moitié extérieure. */
  readonly rim: number;
  /** Épaisseur maximale de la coque (px). */
  readonly thick: number;
}

/** Couverture de la coque `base` par les polygones `polys` (mesure unique du moteur et de la vérification). `exclude` : zones clairsemées voulues (éclaircissement), hors mesure. */
export function shellCoverage(S: SkullSurface, base: Poly, W: number, polys: readonly Poly[], exclude: readonly Poly[] = []): ShellCoverage {
  const g = gridOver(base, COVER_CELL * W), inside = new Uint8Array(g.nx * g.ny), cover = new Uint8Array(g.nx * g.ny);
  paint(g, base, inside);
  for (const q of polys) paint(g, q, cover);
  const thick = ringThickness(S, base);
  let tot = 0, bare = 0, rimTot = 0, rimBare = 0;
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    if (exclude.length) { const c = centerOf(g, i); if (exclude.some((q) => inPoly(q, c.x, c.y))) continue; }
    tot++;
    const open = !cover[i];
    if (open) bare++;
    if (distanceOutsideSkull(S, centerOf(g, i), 60) >= RIM_FROM * thick) { rimTot++; if (open) rimBare++; }
  }
  return { all: tot ? bare / tot : 0, rim: rimTot ? rimBare / rimTot : 0, thick };
}

/** Mèches de remplissage de la coque. Tire sa PROPRE graine et s'exécute en dernier : le reste de la chevelure est identique avec ou sans remplissage. */
export function fillShell(ctx: HairCtx, base: Poly, existing: readonly HairLock[]): HairLock[] {
  const spec = FILL[ctx.h.style as Style];
  if (!spec || ctx.h.sim.enabled) return [];
  const { lm, boundary, def, h, hl } = ctx;
  const { W, H } = lm, S = boundary.skull;
  const g: Grid = gridOver(base, COVER_CELL * W);
  const N = g.nx * g.ny, inside = new Uint8Array(N), cover = new Uint8Array(N), dead = new Uint8Array(N);
  paint(g, base, inside);
  for (const l of existing) if (l.layer === 'front' && l.rank !== 'hairline') paint(g, l.poly, cover);
  const thick = ringThickness(S, base);
  const cells: number[] = [], dist = new Float32Array(N);
  for (let i = 0; i < N; i++) if (inside[i]) { cells.push(i); dist[i] = distanceOutsideSkull(S, centerOf(g, i), 60); }
  // Zones clairsemées voulues (éclaircissement) : ni racine ni couverture exigée.
  const thin = bareScalp(ctx).thin;
  const keep = fillKeep(h), rimT = relaxedBare(spec.rim, keep), allT = relaxedBare(spec.all, keep), cap = Math.ceil(spec.max * keep);
  for (let n = cells.length - 1; n >= 0 && thin.length; n--) {
    const c = centerOf(g, cells[n] as number);
    if (thin.some((q) => inPoly(q, c.x, c.y))) cells.splice(n, 1);
  }
  const rimCells = cells.filter((i) => (dist[i] as number) >= RIM_FROM * thick);
  const rnd = mulberry32(((h.seed ^ 0xf177) * 2654435761) >>> 0);
  const out: HairLock[] = [];
  let strands = 0;
  const share = (list: readonly number[]): number => {
    let b = 0;
    for (const i of list) if (!cover[i]) b++;
    return list.length ? b / list.length : 0;
  };
  while (strands < cap) {
    if (share(rimCells) <= rimT && share(cells) <= allT) break;
    // Cellule nue la plus EXTÉRIEURE (le bord d'abord : c'est lui qui fait la silhouette), départage aléatoire d'une demi-cellule.
    let best = -1, bs = -Infinity;
    for (const i of cells) {
      if (cover[i] || dead[i]) continue;
      const s = (dist[i] as number) + 0.5 * g.cell * rnd();
      if (s > bs) { bs = s; best = i; }
    }
    if (best < 0) break;
    const c = centerOf(g, best);
    // Essais de racine : en retrait sur la normale (la mèche traverse la cellule en allant vers l'extérieur), puis à la cellule, puis en retrait double.
    // Une mèche qui ne couvre aucune cellule nouvelle (le champ la ramène sur du déjà couvert) est refaite d'un autre point avant de condamner la cellule.
    const len = spec.len * H, nrm = { x: c.x - ctx.C.x, y: c.y - ctx.C.y }, nl = Math.hypot(nrm.x, nrm.y) || 1;
    const wd = (def.mainW[0] + def.mainW[1] * h.volume) * W * (0.9 + 0.3 * rnd());
    const tone = -(0.04 + 0.26 * rnd());
    let made: HairLock[] = [];
    for (const back of [0.5, 0, 1]) {
      let R: Vec = { x: c.x - (nrm.x / nl) * back * len, y: c.y - (nrm.y / nl) * back * len };
      if (R.y > hl.yAt(R.x) - 0.012 * H || indexAt(g, R.x, R.y) < 0 || !inside[indexAt(g, R.x, R.y)]) R = c;
      const pts = growLock(ctx, R, len);
      // Rognée au bord de la coque : la mèche texture le contour, elle ne le dépasse pas.
      let keep = pts.length;
      for (let k = 2; k < pts.length; k++) { const q = pts[k] as Vec, ix = indexAt(g, q.x, q.y); if (ix < 0 || !inside[ix]) { keep = k; break; } }
      if (keep < 5) continue;
      const trial = lockFrom(ctx, pts.slice(0, keep), { width: wd, rank: 'main', tone, layer: 'front', sharp: def.sharp, edgeFade: h.tips.edgeFade, flick: h.tips.flick, ragged: h.tips.irregular, reach: 'cranial' });
      // Gain mesuré sur une copie : on ne retient que l'essai qui couvre la cellule visée.
      const probe = cover.slice(); let gain = 0;
      for (const l of trial) gain += paint(g, l.poly, probe);
      if (gain >= 2 && probe[best]) { made = trial; break; }
    }
    if (!made.length) { dead[best] = 1; continue; }
    for (const l of made) paint(g, l.poly, cover);
    strands++;
    out.push(...made.map((l): HairLock => ({ ...l, fill: strands })));
  }
  return out;
}
