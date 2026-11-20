import { smooth } from './vec';

/**
 * GRAMMAIRE DES PROFILS DE LARGEUR LOCAUX — s'ajoute au profil de base (naissance douce, maximum, pointe effilée de `blade.ts`).
 * Chaque opération agit sur une portion de la mèche (t ∈ [0,1]) :
 *  - `bulge`  : renflement (masse qui gonfle) ; `pinch` : étranglement (mèche qui se resserre, ouvre un espace négatif) ;
 *  - `flat`   : section aplatie — la largeur est tenue constante de `from` à `to` (pas d'effilement dans la portion) ;
 *  - `step`   : changement de volume brusque (`sharp` grand) ou progressif (`sharp` petit) vers `ratio` × la largeur courante.
 * La torsion du ruban (voir `curve-program.ts`) agit à part : un ruban vu par la tranche paraît fin (`twistWidth`).
 */
export type WidthOp =
  | { readonly kind: 'bulge'; readonly at: number; readonly span: number; readonly gain: number }
  | { readonly kind: 'pinch'; readonly at: number; readonly span: number; readonly depth: number }
  | { readonly kind: 'flat'; readonly from: number; readonly to: number }
  | { readonly kind: 'step'; readonly at: number; readonly ratio: number; readonly sharp: number };

/** Bosse à support compact (cosinus relevé) : 1 en `at`, 0 à ±`span`. */
const bump = (t: number, at: number, span: number): number => 0.5 * (1 + Math.cos(Math.PI * Math.min(1, Math.max(-1, (t - at) / Math.max(1e-6, span)))));

/** Largeur relative (0–1+) à t : profil de base `base` modifié par les opérations, dans l'ordre. */
export function widthAt(ops: readonly WidthOp[] | undefined, t: number, base: (t: number) => number): number {
  let w = base(t);
  if (!ops) return w;
  for (const op of ops) {
    switch (op.kind) {
      case 'bulge': w *= 1 + op.gain * bump(t, op.at, op.span); break;
      case 'pinch': w *= 1 - Math.min(0.95, op.depth) * bump(t, op.at, op.span); break;
      case 'flat': if (t > op.from && t < op.to) w = base(op.from); break;
      case 'step': w *= 1 + (op.ratio - 1) * smooth((t - op.at) * op.sharp + 0.5); break;
    }
  }
  return w;
}

/** Plancher de largeur apparente d'un ruban vu par la tranche (jamais nul : le bord reste dessiné). */
export const TWIST_MIN = 0.16;
/** Largeur apparente d'un ruban tordu d'un angle φ (rad) autour de son axe : |cos φ| lissé jusqu'au plancher. */
export const twistWidth = (phi: number): number => TWIST_MIN + (1 - TWIST_MIN) * Math.abs(Math.cos(phi));
