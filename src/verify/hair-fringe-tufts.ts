import type { HairGeometry, HairLock } from '../face/hair';
import { check, type Check } from './types';

/**
 * FORME DES TOUFFES DE FRANGE (`docs/HAIR-BLADES.md`). Complète `hair-fringe-edge.ts` (RYTHME : pas et largeurs inégaux) par la FORME : une frange en lames qui se lit
 * comme des éclats de verre posés sur le front a trois défauts mesurables sur les mèches du moteur v2 (`kind === 'fringe'`, rang `main`) :
 *  - des TROUS entre les racines : l'écart entre deux touffes voisines (hors jour) dépasse leur largeur ; le jour central est le plus grand écart, il est exclu ;
 *  - une touffe GÉANTE : une seule lame couvre une grande part du front ;
 *  - des touffes TRAPUES : longueur de la ligne médiane < largeur de base (un triangle large et court, pas une mèche).
 * Lit `spine` et `w0` des mèches (les mêmes champs que le rendu) : aucune géométrie recalculée.
 */
export interface TuftStats {
  readonly n: number;
  /** Deuxième plus grand écart entre intervalles de racine voisins, en fraction de W (le plus grand est le jour). 0 s'il y a moins de 3 touffes. */
  readonly gap: number;
  /** Plus grande largeur de base, fraction de W. */
  readonly maxW: number;
  /** Part des touffes dont la ligne médiane est plus courte que leur largeur de base. */
  readonly squat: number;
}

/**
 * ROUGOSITÉ DU BORD de la frange (toutes les mèches de frange, fines comprises) : écart moyen entre la profondeur de pointe d'une mèche et la moyenne de ses deux voisines
 * (triées par abscisse de racine), en fraction de H. Une scie alterne pointe longue / pointe courte : forte rugosité ; une frange en masses douces : faible. `null` : moins de 5 mèches.
 */
export function tipJag(geo: HairGeometry, H: number): number | null {
  const ls = geo.locks.filter((l) => !l.sim && l.layer === 'front' && l.kind === 'fringe' && !!l.spine).sort((a, b) => (a.spine as { x: number }[])[0]!.x - (b.spine as { x: number }[])[0]!.x);
  if (ls.length < 5) return null;
  const y = ls.map((l) => (l.spine as { y: number }[])[(l.spine as unknown[]).length - 1]!.y);
  let s = 0;
  for (let i = 1; i < y.length - 1; i++) s += Math.abs(y[i]! - (y[i - 1]! + y[i + 1]!) / 2);
  return s / (y.length - 2) / H;
}

const arc = (s: readonly { x: number; y: number }[]): number => s.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - s[i]!.x, p.y - s[i]!.y), 0);
export const isTuft = (l: HairLock): boolean => !l.sim && l.layer === 'front' && l.kind === 'fringe' && l.rank === 'main' && !!l.spine && l.w0 !== undefined;

export function tuftStats(geo: HairGeometry, W: number): TuftStats | null {
  const ls = geo.locks.filter(isTuft);
  if (!ls.length) return null;
  const iv = ls.map((l) => {
    const x = (l.spine as { x: number }[])[0]!.x, half = ((l.w0 as number) * (l.rootW ?? (l.profile === 'cone' ? 1 : 0.8))) / 2;
    return [x - half, x + half] as const;
  }).sort((a, b) => a[0] - b[0]);
  // Écarts entre l'extrémité la plus à droite atteinte jusqu'ici et la racine suivante (un intervalle couvert par un voisin n'ouvre aucun trou).
  const gaps: number[] = [];
  let reach = iv[0]![1];
  for (const [a, b] of iv.slice(1)) { gaps.push(Math.max(0, a - reach)); reach = Math.max(reach, b); }
  gaps.sort((p, q) => q - p);
  const squat = ls.filter((l) => arc(l.spine as { x: number; y: number }[]) < (l.w0 as number)).length;
  return { n: ls.length, gap: ls.length >= 3 ? (gaps[1] ?? 0) / W : 0, maxW: Math.max(...ls.map((l) => l.w0 as number)) / W, squat: squat / ls.length };
}

/**
 * NOMBRE DE TOUFFES DISTINCTES de la frange (`docs/HAIR-NATURAL-FRINGE.md`) : le « peigne » est une rangée de pointes séparées. On compte les pointes (dernier point de la ligne médiane)
 * des mèches de frange de rang `main` / `mass`, triées par abscisse ; deux pointes voisines à moins de `TIP_X` × W en x ET `TIP_Y` × H en y ne font qu'une touffe. `null` : moins de 4 pointes
 * (rien à juger : frange absente, ou en fils fins `sheer` / `wispy` par conception).
 */
export const TIP_X = 0.05;
export const TIP_Y = 0.012;
export function tuftCount(geo: HairGeometry, W: number, H: number): number | null {
  const tips = geo.locks.filter((l) => !l.sim && l.layer === 'front' && l.bang === true && (l.rank === 'main' || l.rank === 'mass') && !!l.spine).map((l) => (l.spine as { x: number; y: number }[]).at(-1) as { x: number; y: number }).sort((a, b) => a.x - b.x);
  if (tips.length < 4) return null;
  let n = 0, last: { x: number; y: number } | null = null;
  for (const t of tips) { if (!last || Math.abs(t.x - last.x) >= TIP_X * W || Math.abs(t.y - last.y) >= TIP_Y * H) n++; last = t; }
  return n;
}

/** Seuils posés sur le corpus (126 visages × mode, `docs/HAIR-BLADES.md`) : avant → après (max). Pas de référence dessinée par un illustrateur. */
export const TUFT_LIMITS = { gap: 0.03, maxW: 0.25, squat: 0.7, jag: 0.03, tufts: 20 } as const;

/** Contrôles de forme de la frange. `mode` = `hair.fringeEngine.mode` : continuité, largeur et aspect ne jugent que les lames (les autres modes ouvrent le front par conception). */
export function checkFringeTufts(geo: HairGeometry, mode: string, W: number, H: number): Check[] {
  const out: Check[] = [];
  const st = mode === 'blades' ? tuftStats(geo, W) : null;
  if (st) {
    out.push(check('geometry', 'fringe-tuft-continuous', '<=', st.gap, TUFT_LIMITS.gap, 'des trous de peau entre les racines des touffes (hors jour) : éclats posés sur le front, sans lien avec l\'implantation'));
    out.push(check('geometry', 'fringe-tuft-width', '<=', st.maxW, TUFT_LIMITS.maxW, 'une touffe de frange couvre une trop grande part du front : une lame géante, pas une mèche'));
    out.push(check('style', 'fringe-tuft-slender', '<=', st.squat, TUFT_LIMITS.squat, 'la plupart des touffes de frange sont plus larges que longues : des triangles trapus (dents de requin)'));
  }
  const tc = tuftCount(geo, W, H);
  if (tc !== null) out.push(check('style', 'fringe-tuft-count', '<=', tc, TUFT_LIMITS.tufts, 'la frange est une rangée de pointes séparées (peigne) : plus de touffes distinctes qu\'une frange naturelle', 'warn'));
  const jag = tipJag(geo, H);
  if (jag !== null) out.push(check('style', 'fringe-tip-jag', '<=', jag, TUFT_LIMITS.jag, 'le bord inférieur de la frange alterne pointes longues et courtes : une scie', 'warn'));
  return out;
}
