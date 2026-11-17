import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt } from '../outline';

/**
 * CRÂNE COMPLET : cranium ellipsoïdal (rx, ry, rz) + mâchoire (cône tronqué du coin de mâchoire au menton). Sert de support 3D à
 * tous les enfants : profondeur de surface z(x, y), silhouette projetée sous rotation. Repère de `tree.ts`, origine = pivot du cou.
 */
export interface RowMap {
  readonly hx: number;
  x(x: number): number;
  slope(x: number): number;
}

export interface Skull {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
  readonly topY: number;
  readonly jawY: number;
  readonly chinY: number;
  readonly jawHalf: number;
  readonly chinHalf: number;
  /** Rapport demi-profondeur / demi-largeur de la section horizontale (`DEPTH_RATIO`) : il fixe la silhouette et le décalage de la projection en lacet. */
  readonly depthRatio: number;
  /** Profondeur de la surface du visage à (x, y) : ellipsoïde au-dessus de la mâchoire, cône dessous. */
  zAt(x: number, y: number): number;
  /** Demi-largeur de la silhouette projetée à l'ordonnée y pour une rotation `yawDeg` (continue en y, ≤ demi-largeur du contour de face). */
  halfAt(y: number, yawDeg: number): number;
  /**
   * Abscisse projetée, après un lacet `yawDeg`, d'un point (x, y) de la vue de FACE posé sur ou autour du crâne (cheveux). Section de hauteur y = ellipse (hx, k·hx). Dans la section (|x| ≤ hx) le point est sur la surface :
   * x = hx·sin φ → x' = hx·ρ·sin(φ + ψ·cos φ), où ρ = √(cos²a + k²sin²a) et ψ = atan(k·tan a) (la rotation exacte est φ + ψ ; le facteur cos φ la fait s'annuler aux limbes : le bord du crâne reste le bord de la silhouette
   * `halfAt`, sans repli ni jour ; ψ est plafonné à `PSI_MAX`). Hors de la section (cheveux qui dépassent du crâne) l'épaisseur t = |x| − hx est conservée à partir de la silhouette : x' = ±(hx·ρ + t).
   */
  projectX(x: number, y: number, yawDeg: number): number;
  /** Pente locale ∂x'/∂x de `projectX` en (x, y) : < 1 = raccourcissement (côté qui se présente de profil), > 1 = dépliage de la bande écrasée du limbe lointain. Sert à ne JAMAIS étirer une mèche (`hair-pose-strand.ts`). */
  slopeX(x: number, y: number, yawDeg: number): number;
  /** Projection d'UNE rangée (ordonnée y, lacet fixés) : demi-largeur de référence `hx`, abscisse projetée `x(·)` et pente `slope(·)` EXACTE (analytique), sans relire le contour à chaque point. */
  rowMap(y: number, yawDeg: number): RowMap;
  /** Demi-largeur de référence des cheveux qui RETOMBENT à l'ordonnée y : celle du contour au-dessus de la mâchoire, puis, sous la mâchoire, la demi-largeur de la mâchoire (le menton se rétrécit, pas la chevelure qui pend de la tête). */
  hangHalf(y: number): number;
}

/** Plafond (rad) du décalage ψ de `projectX` : au-delà de 1 rad la rotation exacte φ + ψ·cos φ n'est plus monotone (repli de la surface près du limbe proche). Atteint à partir d'un lacet de ≈ 50° ; au-delà, la face avance moins que la rotation exacte. */
const PSI_MAX = 0.95;

/**
 * Rapport demi-profondeur / demi-largeur du crâne, MESURÉ : l'indice céphalique 3D de la planche de référence `rotation-3d/07` vaut 0,975 (largeur du contour de face / longueur ; `docs/HEAD-TURNTABLE-SKULL-2.md` §4), soit
 * profondeur / largeur = 1/0,975 = 1,026 → 1,03. L'ancienne valeur 0,92 était une convention d'étape 1 (`rz` / `rx`) : elle donnait une tête plus étroite en profondeur qu'en largeur, ce que ni la planche ni un crâne humain ne montrent.
 * `rz` (profondeur de la SEULE face, 0,92 rx) reste la valeur de `zAt` ; 1,03 est la moyenne face / arrière de la section : face 0,92, arrière 2 × 1,03 − 0,92 = 1,14 (asymétrie : `docs/ROTATION-HAIR-DECISIONS.md`).
 */
export const DEPTH_RATIO = 1.03;

export function skullOf(lm: FaceLandmarks): Skull {
  const { H } = lm;
  const topY = -H / 2;
  const rx = halfWidthAt(lm.outline, lm.eyeY);
  const cy = (topY + lm.jawY) / 2;
  const ry = (lm.jawY - topY) / 2;
  const rz = 0.92 * rx;
  const jawHalf = halfWidthAt(lm.outline, lm.jawY);
  const chinHalf = Math.max(0.02 * lm.W, halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, lm.chinY - 0.02 * H)));
  const zAt = (x: number, y: number): number => {
    if (y <= lm.jawY) {
      const q = 1 - (x / rx) ** 2 - ((y - cy) / ry) ** 2;
      return rz * Math.sqrt(Math.max(0, q));
    }
    const u = Math.min(1, (y - lm.jawY) / Math.max(1e-6, lm.chinY - lm.jawY));
    const w = jawHalf + (chinHalf - jawHalf) * u;
    const zj = rz * 0.62 * (1 - 0.35 * u);
    return zj * Math.sqrt(Math.max(0, 1 - (x / Math.max(w, 1e-6)) ** 2));
  };
  // Silhouette en lacet : à chaque ordonnée, la section du crâne est l'ellipse (hx, k·hx) où hx est la demi-largeur RÉELLE du contour et k = `DEPTH_RATIO` (mesuré) le rapport profondeur / largeur du crâne ;
  // sa demi-largeur projetée est hx·√(cos²a + k²·sin²a). Même formule à toutes les hauteurs : continue, bornée par [cos a, k] × le contour de face, sans le saut de la mâchoire ni l'élargissement du menton
  // que donnait la version précédente (profondeur d'ellipsoïde au-dessus de la mâchoire, profondeur du cône dessous : saut de 0,78 à 0,95 de `hx` à `jawY`, menton jusqu'à 1,55 × `hx` à 40°).
  const k = DEPTH_RATIO;
  const halfAt = (y: number, yawDeg: number): number => {
    const a = (yawDeg * Math.PI) / 180;
    const hx = halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(topY, y)));
    return hx * Math.hypot(Math.cos(a), k * Math.sin(a));
  };
  // Demi-largeur de référence des cheveux qui retombent : le contour au-dessus de la mâchoire ; dessous, la largeur de la mâchoire (jamais celle du menton qui se rétrécit).
  const hangHalf = (y: number): number => {
    const ye = Math.min(lm.chinY - 0.02 * H, Math.max(topY + 0.02 * H, y));
    return Math.max(1e-6, ye <= lm.jawY ? halfWidthAt(lm.outline, ye) : Math.max(halfWidthAt(lm.outline, ye), jawHalf));
  };
  const rowMap = (y: number, yawDeg: number): RowMap => {
    const hx = hangHalf(y);
    if (yawDeg === 0) return { hx, x: (x) => x, slope: () => 1 };
    const a = (yawDeg * Math.PI) / 180, rho = Math.hypot(Math.cos(a), k * Math.sin(a)), psi = Math.max(-PSI_MAX, Math.min(PSI_MAX, Math.atan2(k * Math.sin(a), Math.cos(a))));
    // Largeur de la section lue à l'intérieur de [haut + 2 % H, bas du menton − 2 % H] : aux deux pointes elle est nulle et le rapport x / hx n'a plus de sens.
    return {
      hx,
      x: (x) => {
        const s = x / hx;
        if (Math.abs(s) >= 1) return Math.sign(x) * (hx * rho + (Math.abs(x) - hx));
        const phi = Math.asin(s);
        return hx * rho * Math.sin(phi + psi * Math.cos(phi));
      },
      // dP/dx = ρ·cos θ·(1 − ψ sin φ) / cos φ, θ = φ + ψ cos φ ; limite aux limbes (L'Hôpital) : ρ(1 ∓ ψ)² (proche : écrasée, lointain : dépliée) ; hors de la section : 1.
      slope: (x) => {
        const s = x / hx;
        if (Math.abs(s) >= 1) return 1;
        const phi = Math.asin(s), c = Math.cos(phi);
        if (c < 1e-6) return rho * (1 - Math.sign(s) * psi) ** 2;
        return (rho * Math.cos(phi + psi * c) * (1 - psi * s)) / c;
      },
    };
  };
  const projectX = (x: number, y: number, yawDeg: number): number => (yawDeg === 0 ? x : rowMap(y, yawDeg).x(x));
  const slopeX = (x: number, y: number, yawDeg: number): number => (yawDeg === 0 ? 1 : rowMap(y, yawDeg).slope(x));
  return { cx: 0, cy, rx, ry, rz, topY, jawY: lm.jawY, chinY: lm.chinY, jawHalf, chinHalf, depthRatio: k, zAt, halfAt, projectX, slopeX, rowMap, hangHalf };
}
