import { norm, type Cubic, type Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { jawDerived, mouthFloorY } from './params';

/**
 * Contour BAS du visage : ramus (temple → coin de mâchoire), coin de mâchoire arrondi selon l'angle mandibulaire, corps de la
 * mandibule, coin du menton, symphyse. Moitié DROITE seulement, de haut en bas ; la gauche en est le miroir.
 * Chaque cubique se raccorde à la précédente avec la MÊME tangente (continuité C1), sauf à l'apex d'un menton pointu (voulu).
 * L'ordonnée `y` est strictement croissante le long du contour : `halfWidthAt` peut donc l'interpoler sans ambiguïté.
 */
export interface LowerContour {
  readonly segments: readonly Cubic[];
  /** Points clés (repère de l'hôte) : coin de mâchoire, coin du menton, bas du menton (centre). */
  readonly gonion: Vec;
  readonly chinCorner: Vec;
  readonly bottom: Vec;
  /** Demi-largeur du menton au coin (bornée par la mâchoire). */
  readonly chinHalf: number;
}

/** Part de la hauteur du menton comprise entre le coin du menton et le bas, selon la symphyse. */
const RISE = { round: 0.5, square: 0.3, pointed: 0.75, cleft: 0.45 } as const;
/** Tangente du menton au coin (vers le bas, légèrement vers l'intérieur) selon la symphyse. */
const TANGENT: Record<FaceParams['chin']['symphysis'], Vec> = { round: { x: -0.3, y: 1 }, square: { x: -0.05, y: 1 }, pointed: { x: -0.55, y: 1 }, cleft: { x: -0.2, y: 1 } };
/** Longueur de la poignée horizontale du bas du menton (part de la demi-largeur) : grande = méplat, petite = arrondi serré. */
const FLAT = { round: 0.55, square: 0.9, pointed: 0, cleft: 0.7 } as const;

const dist = (a: Vec, b: Vec): number => Math.hypot(b.x - a.x, b.y - a.y);
const along = (a: Vec, d: Vec, k: number): Vec => ({ x: a.x + d.x * k, y: a.y + d.y * k });

export function lowerContour(p: FaceParams, W: number, H: number, temple: Vec): LowerContour {
  const jd = jawDerived(p, W, H);
  const sym = p.chin.symphysis;
  const jawHalf = (p.jawWidth * W) / 2;
  // Le coin de mâchoire descend d'un tiers de l'abaissement (la mandibule pivote autour du condyle), le menton de tout l'abaissement.
  const G: Vec = { x: jawHalf, y: -H / 2 + p.jawY * H + 0.35 * jd.drop };
  const B: Vec = { x: 0, y: H / 2 + jd.drop };
  const chinHalf = Math.min((p.chinWidth * W) / 2, jawHalf * 0.92);
  // Coin du menton : remonte avec la HAUTEUR du menton (contrôle indépendant de la largeur et de la projection), sous le coin de mâchoire
  // ET sous la lèvre inférieure (la bouche ne tombe jamais sur la partie étroite du menton).
  const C: Vec = { x: chinHalf, y: Math.max(G.y + 0.03 * H, mouthFloorY(p, H) + 0.012 * H, B.y - RISE[sym] * p.chin.height * H) };

  const dIn = norm({ x: G.x - temple.x, y: G.y - temple.y });
  const dOut = norm({ x: C.x - G.x, y: C.y - G.y });
  const ra = Math.min(jd.cornerRadius, 0.45 * dist(temple, G));
  const rb = Math.min(jd.cornerRadius, 0.45 * dist(G, C));
  const A = along(G, dIn, -ra);
  const Bp = along(G, dOut, rb);

  // 1. Ramus : tangente verticale au temple, tangente dIn à l'arrivée ; le contrôle est borné à x ≤ W/2 (le flanc ne dépasse pas le crâne).
  const ramus: Cubic = {
    p0: temple,
    p1: { x: temple.x, y: temple.y + 0.45 * (A.y - temple.y) },
    p2: (() => {
      const c = along(A, dIn, -0.35 * dist(temple, A));
      return { x: Math.min(c.x, temple.x), y: c.y };
    })(),
    p3: A,
  };
  // 2. Coin de mâchoire : arrondi de rayon `cornerRadius` (angle aigu → coin franc, angle obtus → grand arrondi).
  const corner: Cubic = { p0: A, p1: { x: A.x + (G.x - A.x) * 0.55, y: A.y + (G.y - A.y) * 0.55 }, p2: { x: Bp.x + (G.x - Bp.x) * 0.55, y: Bp.y + (G.y - Bp.y) * 0.55 }, p3: Bp };
  // 3. Corps de la mandibule : convexité réglée par la LONGUEUR des poignées (jamais par un décalage latéral, qui casserait la continuité de
  //    tangente aux raccords) : `taper` faible → poignées longues → côtés plus bombés et parallèles ; `taper` fort → corps plus rectiligne en V.
  const tC = norm(TANGENT[sym]);
  const len4 = dist(Bp, C);
  const k4 = 0.3 + 0.25 * (1 - p.jaw.taper);
  const body: Cubic = {
    p0: Bp,
    p1: (() => {
      const q = along(Bp, dOut, k4 * len4);
      return { x: Math.min(q.x, W / 2), y: q.y };
    })(),
    p2: along(C, tC, -k4 * len4),
    p3: C,
  };
  // 4. Symphyse : du coin du menton au centre du bas du menton. Menton pointu : l'arrivée est oblique (apex en V après le miroir) ;
  //    autres formes : tangente horizontale au centre, poignée plus ou moins longue (arrondi serré → méplat).
  const s = (0.45 * (B.y - C.y)) / tC.y;
  const symph: Cubic =
    sym === 'pointed'
      ? { p0: C, p1: { x: C.x + tC.x * s, y: C.y + tC.y * s }, p2: { x: 0.3 * C.x, y: B.y - 0.35 * (B.y - C.y) }, p3: B }
      : { p0: C, p1: { x: C.x + tC.x * s, y: C.y + tC.y * s }, p2: { x: FLAT[sym] * C.x, y: B.y }, p3: B };
  return { segments: [ramus, corner, body, symph], gonion: G, chinCorner: C, bottom: B, chinHalf };
}
