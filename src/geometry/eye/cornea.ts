/**
 * EYE-03D / OPT-02 — CORNÉE ET RÉFRACTION RÉELLE (pure, déterministe). L'iris se voit À TRAVERS la cornée : un rayon parallèle à l'axe (caméra à l'infini) entre à la hauteur `h`
 * sur une calotte sphérique (apex en z = 0, rayon de courbure `Rc = 1 / curvature`, en rayons d'iris), se réfracte selon la loi de Snell (air 1 → `index`), puis rencontre le plan de
 * l'iris à la profondeur `depth`, au rayon vrai `r(h)`. On inverse numériquement : un point de l'iris au rayon vrai ρ est VU à la hauteur h(ρ), normalisée pour que le LIMBE reste
 * le bord apparent (`warp(1) = 1` : la taille de l'iris des références mesurées ne bouge pas, seule sa structure interne se redistribue).
 * `strength` module l'écart à l'identité (0 = aucune réfraction ; 1 = physique ; > 1 = exagération artistique assumée). Défauts = œil humain : Rc ≈ 7,8 mm / R_iris ≈ 5,9 mm → courbure 0,76 ;
 * profondeur apex → plan de l'iris ≈ 3,6 mm → 0,61 ; indice 1,376.
 *
 * Effet : le grossissement croît vers le limbe, donc la structure interne (pupille, collerette) paraît PLUS PETITE et plus serrée au centre, les détails se dilatent vers le bord — la
 * signature qui distingue un iris « sous verre » d'un iris peint. L'identité est exacte à `strength = 0` (la fonction renvoie `rho`).
 */
export interface CorneaParams { readonly curvature: number; readonly depth: number; readonly index: number; readonly strength: number }
export type Warp = (rho: number) => number;
export const IDENTITY_WARP: Warp = (rho) => rho;
const N = 96;

/** Rayon vrai (en rayons d'iris) vu à la hauteur `h` : lancer de rayon à travers la calotte. */
export function trueRadiusAtHeight(h: number, curvature: number, depth: number, index: number): number {
  const Rc = 1 / Math.max(1e-3, curvature); const hh = Math.min(h, Rc * 0.999);
  const zs = Rc - Math.sqrt(Rc * Rc - hh * hh);              // profondeur de la surface à la hauteur h
  const nx = hh / Rc; const nz = (zs - Rc) / Rc;             // normale sortante (vers la caméra : z négatif)
  const cosi = -nz;                                          // d = (0, 1) -> cos de l'incidence = -d·n
  const eta = 1 / index; const k = 1 - eta * eta * (1 - cosi * cosi);
  const q = eta * cosi - Math.sqrt(Math.max(0, k));
  const tx = q * nx; const tz = eta + q * nz;                // direction réfractée
  return hh + (tx / Math.max(1e-6, tz)) * (depth - zs);
}

/** Loi radiale apparente : `warp(ρ)` = fraction du rayon APPARENT où l'on voit le point d'iris de fraction vraie ρ. Monotone, `warp(0)=0`, `warp(1)=1`. */
export function corneaWarp(p: CorneaParams): Warp {
  if (p.strength <= 0) return IDENTITY_WARP;
  // table (ρ vrai -> h apparent) par échantillonnage de h ; on borne à la zone où r(h) reste croissant (rayons non rasants)
  const hs: number[] = []; const rs: number[] = []; const hMax = 1.6 / Math.max(1, 1 / Math.max(1e-3, p.curvature));
  for (let i = 0; i <= N * 4; i++) {
    const h = (hMax * i) / (N * 4); const r = trueRadiusAtHeight(h, p.curvature, p.depth, p.index);
    if (rs.length && r <= (rs[rs.length - 1] as number)) break; hs.push(h); rs.push(r);
  }
  const h1 = lerpAt(rs, hs, 1);
  if (!Number.isFinite(h1) || h1 <= 0 || (rs[rs.length - 1] as number) < 1) return IDENTITY_WARP;   // paramètres hors domaine (rayons rasants) : aucune déformation plutôt qu'un artefact
  const phys = (rho: number): number => lerpAt(rs, hs, Math.min(1, Math.max(0, rho))) / h1;
  return (rho) => { const r = Math.min(1, Math.max(0, rho)); return Math.min(1, Math.max(0, r + p.strength * (phys(r) - r))); };
}

function lerpAt(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= (xs[0] as number)) return ys[0] as number;
  for (let i = 1; i < xs.length; i++) if (x <= (xs[i] as number)) { const t = (x - (xs[i - 1] as number)) / ((xs[i] as number) - (xs[i - 1] as number)); return (ys[i - 1] as number) + t * ((ys[i] as number) - (ys[i - 1] as number)); }
  return ys[ys.length - 1] as number;
}
