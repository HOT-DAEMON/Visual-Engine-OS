import type { HairGeometry, HairLock } from '../face/hair';

/**
 * RÉGULARITÉ DE LA FRANGE (`docs/HAIR-FORM-FRINGE.md`). Une frange naturelle est faite de touffes inégales : largeurs, espacements et longueurs varient, des mèches fines
 * dépassent. Une « scie » (peigne) est une suite de mèches de même largeur à intervalles réguliers : les dents du bord inférieur ont toutes la même forme.
 *
 * Mesure sur les mèches de frange (`kind === 'fringe'` du moteur v2 ou `bang` de la frange classique) : coefficient de variation (écart-type / moyenne) des
 *  - ESPACEMENTS entre racines voisines (abscisses triées),
 *  - LARGEURS de base (`w0`),
 * `regularity` = max des deux : une scie a les DEUX faibles, une frange naturelle au moins un élevé. Moins de `MIN_LOCKS` mèches : rien à juger (+∞).
 * (Essayé d'abord : proéminence et espacement des pics de l'enveloppe inférieure. Ne discriminait pas : les hauteurs de pointe sont déjà tirées au hasard, c'est la SIMILARITÉ
 * des dents — largeur et pas — qui fait lire le peigne ; voir `docs/HAIR-FORM-FRINGE.md`.)
 */
export const MIN_LOCKS = 6;

export interface FringeRhythm {
  readonly locks: number;
  readonly cvSpacing: number;
  readonly cvWidth: number;
  /** max(cvSpacing, cvWidth) ; `Infinity` s'il y a moins de `MIN_LOCKS` mèches (rien à juger). */
  readonly regularity: number;
}

const cv = (v: readonly number[]): number => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return m > 0 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) / m : 0;
};

/** Mèche de frange du corps de la frange (pas un fil isolé : `fine` et `hairline` n'entrent pas dans le rythme). */
export const isFringeLock = (l: HairLock): boolean => !l.sim && l.layer === 'front' && (l.kind === 'fringe' || l.bang === true) && (l.rank === 'main' || l.rank === 'mass');

export function fringeRhythm(geo: HairGeometry): FringeRhythm | null {
  const ls = geo.locks.filter((l) => isFringeLock(l) && l.spine && l.w0 !== undefined);
  if (ls.length < MIN_LOCKS) return ls.length ? { locks: ls.length, cvSpacing: 0, cvWidth: 0, regularity: Infinity } : null;
  const xs = ls.map((l) => (l.spine as { x: number }[])[0]!.x).sort((a, b) => a - b);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]!).filter((g) => g > 1e-6);
  const cs = gaps.length >= 2 ? cv(gaps) : 0, cw = cv(ls.map((l) => l.w0 as number));
  return { locks: ls.length, cvSpacing: cs, cvWidth: cw, regularity: Math.max(cs, cw) };
}
