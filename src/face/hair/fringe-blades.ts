import { clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { LockRank } from './types';

/** Description d'une touffe de frange avant construction de la ligne médiane (voir `fringe2.ts`). */
export interface BladeSpec {
  readonly xRoot: number;
  readonly xTip: number;
  readonly yTip: number;
  readonly w0: number;
  readonly rank: LockRank;
  readonly profile: 'ribbon' | 'cone';
  readonly power: number;
  readonly fade: number;
  readonly ragged: number;
  /** Pointe : 0 = arrondie, 1 = aiguille (profil `ribbon`). */
  readonly sharp: number;
  /** Largeur relative de la racine (profil `ribbon`) : 1 = pleine largeur dès l'implantation. */
  readonly rootW?: number;
}

export interface BladeArgs {
  readonly n: number;
  /** Tirages déjà consommés dans le flux principal, une valeur par touffe (l'ordre d'appel de `rnd` ne change pas). */
  readonly pre: readonly { a: number; b: number; c: number }[];
  readonly xF: number;
  /** Centre et demi-largeur du jour (le front reste visible entre les deux groupes de touffes). */
  readonly gc: number;
  readonly gw: number;
  readonly side: number;
  readonly seed: number;
  /** Ordonnée de pointe : fraction `f` de l'espace entre l'implantation et la limite des sourcils. */
  readonly yAt: (x: number, f: number) => number;
}

/** Recouvrement des racines : largeur de base / pas local. > 1 : les touffes voisines se chevauchent, la peau ne se voit qu'entre les pointes. */
export const OVERLAP = [1.35, 1.9] as const;
/** Les touffes sont `DENSIFY` fois plus nombreuses que les tirages du flux principal (tirage propre : le flux principal ne bouge pas) ; plafond `MAX_TUFTS`. */
export const DENSIFY = 3;
export const MAX_TUFTS = 20;
/** Longueur de pointe (fraction de l'espace disponible) : côté long, côté court. */
const LEN = { long: [0.68, 0.26], short: [0.38, 0.3] } as const;

const cv = (v: number[]): number => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return m > 0 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) / m : 0;
};

/**
 * TOUFFES CONTINUES (`docs/HAIR-BLADES.md`). Avant : quelques grandes lames triangulaires à bords droits, isolées, avec de larges trous de peau entre elles :
 * des éclats posés sur le front, sans lien avec l'implantation. Maintenant :
 *  - racines CONTINUES le long de l'implantation, de part et d'autre du jour (le jour est un vide central, pas un trou entre deux dents) ;
 *  - largeur de base ∝ pas local × recouvrement (1,5 à 2,3) : les touffes se chevauchent à la racine, les fentes de peau ne s'ouvrent qu'entre les pointes ;
 *  - longueurs CORRÉLÉES (une ondulation douce + le tirage de chaque touffe) : les touffes voisines se ressemblent, comme une masse de cheveux qui se sépare ;
 *  - profil lancéolé (`ribbon`, pointe effilée, ventre au premier tiers), penché vers l'extérieur du jour, de plus en plus loin du jour.
 * Le tirage de la mise en page est retenté (≤ 8 fois) tant que le rythme (CV des pas / des largeurs) fait peigne.
 */
export function layoutBlades(a: BladeArgs, minRhythm = 0.4): BladeSpec[] {
  const { pre, xF, gc, gw, side } = a;
  const n = Math.min(MAX_TUFTS, a.n * DENSIFY);
  const away = (x: number): number => (x < gc ? -1 : 1);
  const layout = (attempt: number): BladeSpec[] => {
    const fr = mulberry32(((a.seed ^ 0xb1ade) * 2654435761 + attempt * 40503) >>> 0);
    const gaps = Array.from({ length: n - 1 }, () => 0.7 + 1.6 * fr() * fr());
    const gsum = gaps.reduce((s, g) => s + g, 0);
    const lo = -0.88 * xF, hi = 0.88 * xF, left = Math.max(0, gc - gw - lo), right = Math.max(0, hi - gc - gw);
    let acc = 0;
    const us = [0, ...gaps.map((g) => (acc += g, acc / gsum))];
    const xs = us.map((u) => {
      const p = u * (left + right);
      return p < left ? lo + p : gc + gw + (p - left);
    });
    const mean = (left + right) / n, phase = fr() * 6.283;
    return xs.map((x, i) => {
      const q = pre[i % pre.length] as { a: number; b: number; c: number };
      // Les touffes ajoutées reprennent le tirage de leur modèle, décalé par le flux propre : voisines semblables, jamais identiques.
      const r = i < pre.length ? q : { a: (q.a + 0.5 * fr()) % 1, b: (q.b + 0.5 * fr()) % 1, c: (q.c + 0.5 * fr()) % 1 };
      const pitch = clamp(((xs[i + 1] ?? x + mean) - (xs[i - 1] ?? x - mean)) / 2, 0.6 * mean, 1.5 * mean);
      const long = Math.sign(x - gc) === side, spec = long ? LEN.long : LEN.short;
      const bias = 0.1 * Math.sin(2 * Math.PI * us[i]! * 1.4 + phase);
      const f = clamp(spec[0] + spec[1] * r.b + bias, 0.2, 0.92);
      const reach = Math.min(1, Math.abs(x - gc) / (0.5 * xF));
      const thin = fr() < 0.2 ? 0.6 : 1;
      return { xRoot: x, xTip: x + away(x) * (0.05 + 0.2 * r.a) * xF * (0.5 + 0.5 * reach), yTip: a.yAt(x, f), w0: pitch * (OVERLAP[0] + (OVERLAP[1] - OVERLAP[0]) * r.c) * thin, rank: 'main', profile: 'ribbon', power: 1, fade: 0, ragged: 0, sharp: 0.5 + 0.3 * fr(), rootW: 1 } satisfies BladeSpec;
    });
  };
  const rhythm = (bs: BladeSpec[]): number => {
    const xs = bs.map((b) => b.xRoot).sort((p, q) => p - q);
    return Math.min(cv(xs.slice(1).map((x, k) => x - (xs[k] as number)).filter((g) => g > 1e-6)), cv(bs.map((b) => b.w0)));
  };
  let best = layout(0), bestR = rhythm(best);
  for (let t = 1; t < 8 && bestR < minRhythm; t++) { const c = layout(t), r = rhythm(c); if (r > bestR) { best = c; bestR = r; } }
  return best;
}
