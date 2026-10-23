import { norm, type Cubic, type Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { jawDerived, mouthFloorY } from './params';
import { bodyHandle, chinShape, jawSilhouette, ramusHandle } from './structure';

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
  /** Demi-largeur demandée (`chinWidth`) et plancher de continuité mandibule → menton : `chinHalf = max(demandée, plancher)`. */
  readonly chinHalfRequested: number;
  readonly chinHalfFloor: number;
}

const dist = (a: Vec, b: Vec): number => Math.hypot(b.x - a.x, b.y - a.y);
const along = (a: Vec, d: Vec, k: number): Vec => ({ x: a.x + d.x * k, y: a.y + d.y * k });

export function lowerContour(p: FaceParams, W: number, H: number, temple: Vec): LowerContour {
  const jd = jawDerived(p, W, H);
  // Forme du bas du menton (continue ou historique) et silhouette extérieure (os + muscle + graisse) : voir `structure.ts`.
  const shape = chinShape(p);
  const jawHalf = jawSilhouette(p, W).outerHalf;
  // Le coin de mâchoire descend d'un tiers de l'abaissement (la mandibule pivote autour du condyle), le menton de tout l'abaissement.
  const G: Vec = { x: jawHalf, y: -H / 2 + p.jawY * H + 0.35 * jd.drop };
  const B: Vec = { x: 0, y: H / 2 + jd.drop };
  // Coin du menton : remonte avec la HAUTEUR du menton, sous le coin de mâchoire ET sous la lèvre inférieure.
  const Cy = Math.max(G.y + 0.03 * H, mouthFloorY(p, H) + 0.012 * H, B.y - shape.rise * p.chin.height * H);
  const tail = B.y - Cy;
  // CONTINUITÉ MANDIBULE → MENTON (garantie par construction, pas par réglage) : le contour G → C → B est CONVEXE si et seulement si C est
  // à l'extérieur de la droite G–B. Un menton plus étroit que cette droite crée un creux sous les angles de la mâchoire puis une « goutte » pendante.
  // On impose donc un plancher de demi-largeur : la droite G–B à la hauteur de C, majorée d'un renflement (une pointe garde un renflement faible : V arrondi).
  const xLine = (G.x * tail) / Math.max(1e-6, B.y - G.y);
  const bulge = (0.012 + 0.03 * Math.min(1, Math.max(0, 1 - shape.pointedness))) * W;
  const requested = Math.min((p.chinWidth * W) / 2, jawHalf * 0.92);
  const floor = Math.min(jawHalf * 0.92, xLine * 1.12 + bulge);
  const chinHalf = Math.max(requested, floor);
  const C: Vec = { x: chinHalf, y: Cy };

  const dIn = norm({ x: G.x - temple.x, y: G.y - temple.y });
  const ra = Math.min(jd.cornerRadius, 0.45 * dist(temple, G));

  // 1. Ramus : tangente verticale au temple, tangente dIn à l'arrivée ; le contrôle est borné à x ≤ W/2 (le flanc ne dépasse pas le crâne).
  const A = along(G, dIn, -ra);
  const ramus: Cubic = {
    p0: temple,
    p1: { x: temple.x, y: temple.y + 0.45 * (A.y - temple.y) },
    p2: (() => {
      const c = along(A, dIn, -ramusHandle(p) * dist(temple, A));
      return { x: Math.min(c.x, temple.x), y: c.y };
    })(),
    p3: A,
  };

  // 2-4. Coin de mâchoire, corps, symphyse. Les angles (depuis la verticale, vers l'axe) croissent TOUJOURS le long du contour :
  //      φ_out (départ du corps) < φ_corde (G→C) < φ_C (arrivée au coin du menton) ≤ φ_max < 90° (bas horizontal).
  //      C'est la définition d'un contour convexe : aucun creux possible. Le départ du corps est plus vertical que la corde (la mandibule bombe vers l'extérieur) ;
  //      sans cela le corps, forcé de partir EXACTEMENT vers C, ferait un S (mesuré : 3–5° de rotation à contre-sens sur le visage médian).
  //      `turnShare` répartit la rotation entre le corps (pointe en V) et la symphyse (menton large). Si la pointe obtenue est trop aiguë (rayon < MIN_TIP),
  //      la part du corps est réduite par pas déterministes : le V s'arrondit.
  const phiChord = Math.atan2(G.x - C.x, Math.max(1e-6, C.y - G.y));
  const phiMax = Math.max(phiChord, Math.atan2(0.9 * C.x, Math.max(1e-6, tail)));
  const k4 = bodyHandle(p);
  const build = (share: number): { corner: Cubic; body: Cubic; symph: Cubic } => {
    const phiC = phiChord + share * (phiMax - phiChord);
    // Départ du corps plus vertical que la corde (bombé). Il peut être plus vertical que le ramus : c'est alors un évasement local du coin de mâchoire (angle gonial
    // qui ressort), borné au coin lui-même ; le CORPS, lui, reste convexe de bout en bout.
    const phiOut = Math.max(0, phiChord - 0.6 * (phiC - phiChord));
    const dOut: Vec = { x: -Math.sin(phiOut), y: Math.cos(phiOut) };
    const tC: Vec = { x: -Math.sin(phiC), y: Math.cos(phiC) };
    const rb = Math.min(jd.cornerRadius, 0.45 * dist(G, C));
    const Bp = along(G, dOut, rb);
    const corner: Cubic = { p0: A, p1: { x: A.x + (G.x - A.x) * 0.55, y: A.y + (G.y - A.y) * 0.55 }, p2: { x: Bp.x + (G.x - Bp.x) * 0.55, y: Bp.y + (G.y - Bp.y) * 0.55 }, p3: Bp };
    // Poignées du corps : bornées à 85 % de la distance jusqu'à l'intersection des deux tangentes (le polygone de contrôle reste convexe).
    const len4 = dist(Bp, C);
    const dx = C.x - Bp.x; const dy = C.y - Bp.y;
    const det = dOut.x * tC.y - dOut.y * tC.x;
    const a1 = Math.abs(det) > 1e-6 ? (dx * tC.y - dy * tC.x) / det : Infinity;
    const b1 = Math.abs(det) > 1e-6 ? (dOut.x * dy - dOut.y * dx) / det : Infinity;
    const h1 = a1 > 0 ? Math.min(k4 * len4, 0.85 * a1) : 0.3 * len4;
    const h2 = b1 > 0 ? Math.min(k4 * len4, 0.85 * b1) : 0.3 * len4;
    const body: Cubic = { p0: Bp, p1: { x: Math.min(Bp.x + dOut.x * h1, W / 2), y: Bp.y + dOut.y * h1 }, p2: along(C, tC, -h2), p3: C };
    // Symphyse : de C au centre du bas, arrivée HORIZONTALE (jamais de V : le bas du menton est toujours arrondi). La poignée du bas est bornée par
    // l'intersection de la tangente avec l'horizontale du bas (au-delà, le contour ferait une boucle).
    const sLen = (0.45 * tail) / tC.y;
    const reachX = C.x + tC.x * (tail / tC.y);
    const flatMax = Math.max(0.1, (0.92 * reachX) / C.x);
    const make = (f: number): Cubic => ({ p0: C, p1: { x: C.x + tC.x * sLen, y: C.y + tC.y * sLen }, p2: { x: f * C.x, y: B.y }, p3: B });
    let flat = Math.min(shape.flat, flatMax);
    let symph = make(flat);
    for (let i = 0; i < 12 && tipRadius(symph) < MIN_TIP * W && flat < flatMax; i++) { flat = Math.min(flatMax, flat + 0.06); symph = make(flat); }
    return { corner, body, symph };
  };
  let share = shape.turnShare;
  let built = build(share);
  for (let i = 0; i < 12 && tipRadius(built.symph) < MIN_TIP * W && share > 0.1; i++) { share = Math.max(0.1, share - 0.08); built = build(share); }
  const { corner, body, symph } = built;
  return { segments: [ramus, corner, body, symph], gonion: G, chinCorner: C, bottom: B, chinHalf, chinHalfRequested: requested, chinHalfFloor: floor };
}

/** Rayon de courbure minimal du bas du menton (px) : échantillonne les 30 % de la fin de la symphyse. */
export function tipRadius(c: Cubic): number {
  let min = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = 0.7 + (0.3 * i) / 24;
    const u = 1 - t;
    const d1 = { x: 3 * (u * u * (c.p1.x - c.p0.x) + 2 * u * t * (c.p2.x - c.p1.x) + t * t * (c.p3.x - c.p2.x)), y: 3 * (u * u * (c.p1.y - c.p0.y) + 2 * u * t * (c.p2.y - c.p1.y) + t * t * (c.p3.y - c.p2.y)) };
    const d2 = { x: 6 * (u * (c.p2.x - 2 * c.p1.x + c.p0.x) + t * (c.p3.x - 2 * c.p2.x + c.p1.x)), y: 6 * (u * (c.p2.y - 2 * c.p1.y + c.p0.y) + t * (c.p3.y - 2 * c.p2.y + c.p1.y)) };
    const k = Math.abs(d1.x * d2.y - d1.y * d2.x) / Math.max(1e-9, Math.hypot(d1.x, d1.y) ** 3);
    if (k > 1e-9) min = Math.min(min, 1 / k);
  }
  return min;
}
/** Rayon minimal du bas du menton, fraction de W : en deçà la pointe devient une arête (silhouette « goutte »). */
export const MIN_TIP = 0.02;
