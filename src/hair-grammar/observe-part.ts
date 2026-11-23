import { DEFAULT_HEAD } from './head';
import type { HeadEllipse, Reference } from './observe';
import { clamp } from './vec';

/**
 * RAIE LUE COMME UN SILLON — une raie est une LIGNE de crâne à découvert, mince, entre deux rideaux de mèches. Jusqu'à la passe 4, la mesure prenait la colonne la moins couverte de la calotte
 * (moyenne mobile de 3 colonnes) : elle lisait donc tout aussi bien une large fenêtre chauve, que le remplissage de calotte comble PAR DÉFINITION — la « netteté » baissait (0,85 → 0,76 ; 0,77 → 0,50)
 * sans que la raie ait changé. Ici, on distingue deux objets :
 *  - un SILLON  : course de colonnes presque vides de largeur ≤ `GROOVE_MAX_H` (0,07 H, soit 2 × `PART_HALF` du couloir protégé) ; c'est la raie. Netteté = profondeur (1 − couverture / couverture de référence (75e centile)) ;
 *  - une FENÊTRE : même chose en plus large — pas une raie : un manque de mèches (`anat.dome`). Sa largeur est rapportée à part (`window`) sans jamais compter comme netteté.
 * Chaque colonne n'est jugée que sur la partie de la calotte qui est DANS le crâne (au-dessus de l'ordonnée −0,5 ry, sous 0,92 × le contour du crâne à cette abscisse) : près du bord de la tête, une colonne
 * « vide » n'est que le fond de l'image. Une course qui touche la première ou la dernière colonne jugée est le bord de la chevelure, pas un sillon : écartée.
 * Les unités sont celles de l'ellipse de tête (u = x / rx) : la mesure s'applique telle quelle à une référence ou à un rendu du moteur, quelle que soit l'échelle.
 */
export interface PartObservation {
  /** Position du sillon (repère de tête, unités rx) ; à défaut de sillon : centre de la plus large fenêtre, sinon 0. */
  readonly u: number;
  /** Netteté 0–1 : profondeur du meilleur sillon ; 0 s'il n'y en a pas. */
  readonly clarity: number;
  /** Largeur du meilleur sillon (unités rx) ; 0 sans sillon. */
  readonly width: number;
  /** Largeur de la plus large fenêtre chauve (unités rx) ; 0 sans fenêtre. */
  readonly window: number;
  readonly groove: boolean;
}

/**
 * Largeur maximale d'un sillon (unités H) : le DOUBLE de la largeur du couloir protégé (2 × `PART_HALF` = 0,07 H, `part-line.ts`), soit 0,14 H. CONVENTION, étalonnée sur la grammaire : les rideaux générés se collent au couloir
 * (bords à 0,04–0,07 H de la ligne) et laissent une ouverture de 0,07–0,15 H ; les fenêtres chauves du rendu brut (ancienne génération) mesuraient 0,24–0,59 rx (0,11–0,27 H) et se lisaient « raie » à tort.
 * Une raie réelle d'illustration est plus fine (quelques % de H) : ce seuil est le plafond tolérable du moteur, pas son objectif — voir `docs/HAIR-PASS5-REMAINING.md`.
 */
export const GROOVE_MAX_H = 0.14;
/** Idem en unités rx de la tête de référence (`rx` = 0,45 H). */
export const GROOVE_MAX_U = GROOVE_MAX_H / DEFAULT_HEAD.rx;
/** Une colonne est « vide » en dessous de cette part de la couverture de référence (75e centile). */
const BARE = 0.35;
/** Étendue latérale cherchée (unités rx) : la raie demandée est bornée à ±0,7 rx (`applyPart`). */
const SPAN = 0.7;
/** Bande verticale de la calotte, en unités ry depuis le centre de la tête : de −0,5 (haut du front) à −0,85 (sommet), bornée par le crâne. */
const V_BOTTOM = -0.5; const V_TOP = -0.85; const SKULL = 0.92; const MIN_ROWS = 5;

const NONE: PartObservation = { u: 0, clarity: 0, width: 0, window: 0, groove: false };

/**
 * Cœur de la mesure, indépendant du support (pixels d'une référence, cellules d'une trame) : `cov[i]` est la part couverte de la colonne i (−1 = colonne non jugée),
 * `uOf(i)` son abscisse (unités rx), `du` la largeur d'une colonne (unités rx).
 */
export function partFromColumns(cov: readonly number[], uOf: (i: number) => number, du: number): PartObservation {
  const judged = cov.map((c, i) => (c >= 0 && Math.abs(uOf(i)) <= SPAN ? i : -1)).filter((i) => i >= 0);
  if (judged.length < 3) return NONE;
  const sorted = judged.map((i) => cov[i] as number).sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length * 0.75)] as number; // 75e centile, pas la médiane : une fenêtre chauve couvrant plus de la moitié des colonnes jugées ne doit pas faire croire à une absence de chevelure
  if (med < 0.05) return NONE; // pas de chevelure à cet endroit : aucune raie lisible
  const first = judged[0] as number; const last = judged.at(-1) as number;
  type Run = { from: number; to: number; depth: number; u: number; width: number };
  const runs: Run[] = []; let from = -1;
  const close = (to: number): void => {
    if (from < 0) return; const idx = judged.filter((i) => i >= from && i <= to); const mean = idx.reduce((a, i) => a + (cov[i] as number), 0) / idx.length;
    // Une course qui touche le bord de la zone jugée est le bord de la chevelure.
    if (from !== first && to !== last) runs.push({ from, to, depth: clamp(1 - mean / med, 0, 1), u: idx.reduce((a, i) => a + uOf(i), 0) / idx.length, width: idx.length * du });
    from = -1;
  };
  let prev = -2;
  for (const i of judged) {
    const bare = (cov[i] as number) < BARE * med;
    if (bare && from >= 0 && i === prev + 1) { prev = i; continue; }
    if (from >= 0) close(prev);
    if (bare) { from = i; prev = i; } else prev = i;
  }
  if (from >= 0) close(prev);
  const tol = GROOVE_MAX_U + du; const grooves = runs.filter((r) => r.width <= tol); const wide = runs.filter((r) => r.width > tol);
  const win = wide.reduce((m, r) => Math.max(m, r.width), 0);
  if (grooves.length) { const g = grooves.reduce((b, r) => (r.depth > b.depth + 1e-9 || (Math.abs(r.depth - b.depth) <= 1e-9 && r.width < b.width) ? r : b)); return { u: g.u, clarity: g.depth, width: g.width, window: win, groove: true }; }
  const w = wide.reduce<Run | null>((b, r) => (!b || r.width > b.width ? r : b), null);
  return { ...NONE, u: w?.u ?? 0, window: win };
}

/** Raie d'une référence : couverture par colonne de pixels (voir l'en-tête pour la bande jugée). */
export function observePart(R: Reference, H: HeadEllipse): PartObservation {
  const cov: number[] = new Array(R.w).fill(-1);
  for (let x = 0; x < R.w; x++) {
    const u = (x + 0.5 - H.cx) / H.rx; if (Math.abs(u) >= 1) continue;
    const top = Math.max(V_TOP, -SKULL * Math.sqrt(1 - u * u)); const y0 = Math.max(0, Math.ceil(H.cy + top * H.ry)); const y1 = Math.min(R.h - 1, Math.floor(H.cy + V_BOTTOM * H.ry));
    if (y1 - y0 + 1 < MIN_ROWS) continue;
    let n = 0; for (let y = y0; y <= y1; y++) n += R.mask[y * R.w + x] as number;
    cov[x] = n / (y1 - y0 + 1);
  }
  return partFromColumns(cov, (x) => (x + 0.5 - H.cx) / H.rx, 1 / H.rx);
}
