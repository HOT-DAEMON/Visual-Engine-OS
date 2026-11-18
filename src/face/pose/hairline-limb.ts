import type { Vec } from '../../geometry/eye/primitives';

/**
 * LISIÈRE SOUS POSE, CONSCIENTE DU LIMBE (`docs/ROTATION-HAIR-LIMB.md`). Projeter les points de la ligne d'implantation un à un (`Skull.projectX`) donne, à la tempe, des défauts qui ne viennent pas de la ligne mais de la carte :
 *  - côté qui passe DERRIÈRE l'horizon (n_z = cos(φ + a) ≤ 0) : la pente tombe à ρ(1−ψ)² (0,045 à 45°), la fin de tempe est écrasée sur le limbe, et comme `hangHalf(y)` varie le long de la courbe la ligne y monte, puis REDESCEND sur le même
 *    contour : un V fin (bras à ≈ 3 px, virage jusqu'à π) ;
 *  - côté qui se présente : la bande est dépliée (pente 2 à 3) et les arêtes s'étirent.
 * Une tempe cachée ne se dessine pas : la ligne s'arrête à l'horizon. Cinq opérations, dans l'espace PROJETÉ, extrémités fixes (coins de tempe : ils portent les pattes) :
 *  1. coupe à l'horizon : la partie contiguë aux extrémités dont n_z < `HIDE_NZ` est remplacée par la CORDE entre le point d'émergence (bissection sur n_z) et le coin de tempe, tous deux sur le limbe ;
 *  2. échantillonnage adaptatif de la partie visible : pas de face ≤ ds ET corde projetée ≤ ds (le dépliage n'étire plus d'arête) ;
 *  3. rééchantillonnage à pas d'arc constant (plus d'amas de points sur la bande écrasée) ;
 *  4. retour dans la silhouette (`inside`), avant ET après la relaxation (elle moyenne avec des extrémités fixes, la silhouette n'est pas convexe partout) ;
 *  5. relaxation des sommets dont le virage dépasse `κ × pas local` : la COURBURE est bornée, pas le virage par sommet (un virage par sommet se contourne en échantillonnant plus fin ; la mesure sur fenêtre d'arc fixe ne se contourne pas).
 * Chaque point posé garde son indice continu `u` dans la ligne de face (pour reporter l'azimut et la hauteur de la lisière).
 */
export interface LimbLine {
  readonly pts: Vec[];
  /** Indice continu dans la ligne de face (0 … n−1) de chaque point posé. */
  readonly u: number[];
}

export interface LimbOptions {
  /** Vrai si le point de FACE est derrière l'horizon (n_z < `HIDE_NZ`). */
  readonly hidden?: (q: Vec) => boolean;
  /** Ramène un point POSÉ dans la silhouette posée du crâne. */
  readonly inside?: (q: Vec) => Vec;
}

/** Visibilité (composante z de la normale) sous laquelle un point de la lisière est tenu pour caché : ≈ 6° au-dessus de l'horizon. */
export const HIDE_NZ = 0.1;

type Map2 = (q: Vec) => Vec;

/** Virage (rad, ≥ 0) en `b` entre les segments ab et bc. */
export const turnAt = (a: Vec, b: Vec, c: Vec): number => Math.abs(Math.atan2((c.y - b.y) * (b.x - a.x) - (c.x - b.x) * (b.y - a.y), (c.x - b.x) * (b.x - a.x) + (c.y - b.y) * (b.y - a.y)));

const dist = (a: Vec, b: Vec): number => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Plus grand virage d'une polyligne ouverte (rad). */
export function maxTurn(line: readonly Vec[]): number {
  let m = 0;
  for (let i = 1; i + 1 < line.length; i++) {
    const t = turnAt(line[i - 1] as Vec, line[i] as Vec, line[i + 1] as Vec);
    if (Number.isFinite(t) && t > m) m = t;
  }
  return m;
}

/** Courbure maximale (rad / px) d'une polyligne : virage d'un sommet ÷ demi-somme de ses deux arêtes. Sert de plafond à la ligne posée (`curvatureCap`). */
export function maxCurvature(line: readonly Vec[]): number {
  let m = 0;
  for (let i = 1; i + 1 < line.length; i++) {
    const a = line[i - 1] as Vec, b = line[i] as Vec, c = line[i + 1] as Vec, len = 0.5 * (dist(a, b) + dist(b, c)), t = turnAt(a, b, c);
    if (len > 1e-9 && Number.isFinite(t)) m = Math.max(m, t / len);
  }
  return m;
}

/** Plafond de courbure de la ligne posée : celui de la ligne de face + 0,05 rad par arête moyenne de face (la ligne de face n'a pas de coin plus vif que cela, la posée n'en gagne pas). */
export function curvatureCap(F: readonly Vec[]): number {
  let len = 0;
  for (let i = 1; i < F.length; i++) len += dist(F[i - 1] as Vec, F[i] as Vec);
  return maxCurvature(F) + (F.length > 1 ? (0.05 * (F.length - 1)) / Math.max(len, 1e-9) : 0);
}

interface Samples { p: Vec[]; u: number[] }

/** Échantillons de la polyligne de face `F` (indices continus `uF`) dont les cordes, de face ET projetées, restent ≤ ds. */
function sample(F: readonly Vec[], uF: readonly number[], P: Map2, ds: number): Samples {
  const p: Vec[] = [], u: number[] = [];
  for (let i = 0; i + 1 < F.length; i++) {
    const a = F[i] as Vec, b = F[i + 1] as Vec, at = (t: number): Vec => lerp(a, b, t);
    let n = Math.max(1, Math.ceil(dist(a, b) / ds), Math.ceil(dist(P(a), P(b)) / ds));
    // La carte n'est pas affine : on raffine tant qu'une corde projetée dépasse 1,25 ds (au plus 6 fois).
    for (let k = 0; k < 6; k++) {
      let worst = 0, prev = P(at(0));
      for (let j = 1; j <= n; j++) { const q = P(at(j / n)); worst = Math.max(worst, dist(prev, q)); prev = q; }
      if (worst <= 1.25 * ds) break;
      n = Math.ceil((n * worst) / ds);
    }
    for (let j = 0; j < n; j++) { p.push(P(at(j / n))); u.push((uF[i] as number) + ((uF[i + 1] as number) - (uF[i] as number)) * (j / n)); }
  }
  if (F.length) { p.push(P(F[F.length - 1] as Vec)); u.push(uF[uF.length - 1] as number); }
  return { p, u };
}

/** Rééchantillonnage à pas d'arc constant ≈ ds ; extrémités conservées, `u` interpolé. */
function resample(p: readonly Vec[], u: readonly number[], ds: number): Samples {
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push((cum[i - 1] as number) + dist(p[i - 1] as Vec, p[i] as Vec));
  const L = cum[cum.length - 1] as number;
  if (!(L > 1e-9) || p.length < 3) return { p: p.map((q) => ({ ...q })), u: [...u] };
  const n = Math.max(2, Math.round(L / ds)), out: Vec[] = [], ou: number[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (L * k) / n;
    while (j + 2 < cum.length && (cum[j + 1] as number) < s) j++;
    const c0 = cum[j] as number, c1 = cum[j + 1] as number, t = c1 > c0 ? Math.min(1, Math.max(0, (s - c0) / (c1 - c0))) : 0;
    out.push(lerp(p[j] as Vec, p[j + 1] as Vec, t));
    ou.push((u[j] as number) + ((u[j + 1] as number) - (u[j] as number)) * t);
  }
  return { p: out, u: ou };
}

/** Relaxe les sommets dont le virage dépasse κ × (demi-somme des arêtes voisines) ; extrémités fixes. Un sommet n'est déplacé que vers la moyenne de ses voisins : il reste dans l'enveloppe convexe de la ligne. */
export function relaxCurvature(p: Vec[], kappa: number): void {
  for (let pass = 0; pass < 4000; pass++) {
    let moved = false;
    for (let i = 1; i + 1 < p.length; i++) {
      const a = p[i - 1] as Vec, b = p[i] as Vec, c = p[i + 1] as Vec;
      if (turnAt(a, b, c) <= kappa * 0.5 * (dist(a, b) + dist(b, c))) continue;
      p[i] = { x: 0.5 * b.x + 0.25 * (a.x + c.x), y: 0.5 * b.y + 0.25 * (a.y + c.y) };
      moved = true;
    }
    if (!moved) return;
  }
}

/** Point d'émergence sur l'arête (hid → vis) de la ligne de face : bissection sur `hidden`. Renvoie le paramètre t ∈ [0, 1] du premier point visible. */
function crossing(a: Vec, b: Vec, hidden: (q: Vec) => boolean): number {
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (hidden(lerp(a, b, mid))) lo = mid; else hi = mid; }
  return hi;
}

/** Corde de `a` à `b` en pas ≈ ds (extrémités comprises) ; `u` interpolé de ua à ub. */
function chord(a: Vec, b: Vec, ua: number, ub: number, ds: number): Samples {
  const n = Math.max(1, Math.round(dist(a, b) / ds)), p: Vec[] = [], u: number[] = [];
  for (let k = 0; k <= n; k++) { p.push(lerp(a, b, k / n)); u.push(ua + (ub - ua) * (k / n)); }
  return { p, u };
}

/**
 * Ligne de face `F` posée par la carte `P`. `ds` = pas d'arc (px), `kappa` = courbure maximale (rad / px, voir `curvatureCap`). Les extrémités sont exactement `P(F[0])` et `P(F[n−1])`.
 */
export function limbLine(F: readonly Vec[], P: Map2, ds: number, kappa: number, opt: LimbOptions = {}): LimbLine {
  const n = F.length;
  if (n < 3) return { pts: F.map(P), u: F.map((_, i) => i) };
  const hid = opt.hidden;
  let vs = 0, ve = n - 1;
  if (hid) {
    while (vs < n && hid(F[vs] as Vec)) vs++;
    while (ve >= 0 && hid(F[ve] as Vec)) ve--;
  }
  // Rien de visible, ou une seule arête : pas de coupe (repli sur la ligne entière).
  const clip = !!hid && vs < ve;
  let vis: { F: Vec[]; u: number[] };
  const head: Samples = { p: [], u: [] }, tail: Samples = { p: [], u: [] };
  if (!clip) vis = { F: [...F], u: F.map((_, i) => i) };
  else {
    const Fv: Vec[] = [], uv: number[] = [];
    if (vs > 0) { const t = crossing(F[vs - 1] as Vec, F[vs] as Vec, hid as (q: Vec) => boolean); Fv.push(lerp(F[vs - 1] as Vec, F[vs] as Vec, t)); uv.push(vs - 1 + t); }
    for (let i = vs; i <= ve; i++) { Fv.push(F[i] as Vec); uv.push(i); }
    if (ve < n - 1) { const t = crossing(F[ve + 1] as Vec, F[ve] as Vec, (q) => (hid as (q: Vec) => boolean)(q)); /* t part de F[ve+1] (caché) vers F[ve] (visible) */ Fv.push(lerp(F[ve + 1] as Vec, F[ve] as Vec, t)); uv.push(ve + 1 - t); }
    vis = { F: Fv, u: uv };
    if (vs > 0) { const c = chord(P(F[0] as Vec), P(vis.F[0] as Vec), 0, vis.u[0] as number, ds); head.p = c.p.slice(0, -1); head.u = c.u.slice(0, -1); }
    if (ve < n - 1) { const last = vis.F.length - 1, c = chord(P(vis.F[last] as Vec), P(F[n - 1] as Vec), vis.u[last] as number, n - 1, ds); tail.p = c.p.slice(1); tail.u = c.u.slice(1); }
  }
  const s = sample(vis.F, vis.u, P, ds);
  const all: Samples = { p: [...head.p, ...s.p, ...tail.p], u: [...head.u, ...s.u, ...tail.u] };
  const r = resample(all.p, all.u, ds);
  r.p[0] = P(F[0] as Vec);
  r.p[r.p.length - 1] = P(F[n - 1] as Vec);
  if (opt.inside) for (let i = 1; i + 1 < r.p.length; i++) r.p[i] = opt.inside(r.p[i] as Vec);
  relaxCurvature(r.p, kappa);
  // La silhouette n'est pas convexe partout et les extrémités sont fixes : la relaxation peut ramener un point dehors. La garantie « dans la silhouette » est donc rétablie après elle.
  if (opt.inside) for (let i = 1; i + 1 < r.p.length; i++) r.p[i] = opt.inside(r.p[i] as Vec);
  return { pts: r.p, u: r.u };
}
