import { clamp, smooth } from '../math';
import type { EngineHead } from './face-model';
import { skinPoints } from './profile';
import { fy } from './units';

/**
 * MODÈLE DE SECTION DE LA MÂCHOIRE. Une coupe horizontale sous la ligne de la bouche n'est PAS une ellipse : c'est le corps de la mandibule, un U (ou un V)
 * dont la plus grande largeur est au BORD ARRIÈRE (coin gonial, là où la face de profil rejoint le cou) et qui se resserre jusqu'au menton. Une ellipse
 * centrée met cette largeur au milieu et fabrique, en vue oblique, un « sac » qui déborde de la mâchoire réelle (mesuré : 0,09–0,10 U à 20°–70°).
 *
 * Moitié avant d'une coupe (voir `Row`) : x = a·sin(φ)^(2/qf), z = zw + (zf − zw)·cos(φ)^(2/pf).
 *   zw : profondeur du point le plus large = zb + wf·(zf − zb), wf PETIT (le point large est contre l'arrière) ; wf croît quand la mâchoire est moins en V (`jaw.taper` ↓).
 *   pf : 2 (ellipse) → 1 (parabole / triangle) quand la convergence vers le menton (`jaw.taper`) augmente.
 *   qf : 2 (menton rond) ; > 2 menton carré (méplat large), < 2 pointu — d'après la forme du menton du moteur de visage (`chin.form` / `chin.symphysis`),
 *        et seulement au niveau du menton (pas aux joues).
 * Le mélange avec l'ellipse des joues est progressif sur [y0, y1] : aucune marche entre le crâne et la mâchoire.
 */
export interface JawShapeParams {
  /** Début / fin du mélange ellipse → mâchoire (U, repère de la tête). */ readonly y0: number; readonly y1: number;
  /** Position relative du point large dans la section (0 = contre l'arrière) : valeur à taper = 1, et pente quand taper → 0. */ readonly wf0: number; readonly wfSlope: number;
  /** Exposant de profondeur : valeur à taper = 1 et pente quand taper → 0. */ readonly pf0: number; readonly pfSlope: number;
  /** Effet de la forme du menton sur l'exposant de largeur (qf = 2 + qfForm·forme·poids du menton). */ readonly qfForm: number;
  /** Hauteur (U) où l'effet du menton atteint son plein poids, et où il commence. */ readonly chinY0: number; readonly chinY1: number;
}

export const JAW_SHAPE: JawShapeParams = { y0: 0.76, y1: 0.95, wf0: 0.04, wfSlope: 0.3, pf0: 0.9, pfSlope: 1.0, qfForm: 0.9, chinY0: 0.9, chinY1: 1.0 };

/** Forme du menton dans [−1 pointu, +1 carré] : `chin.form` si le moteur la donne, sinon déduite de la symphyse. */
export function chinForm(e: EngineHead): number {
  const c = e.p.chin;
  if (c.form !== null) return clamp(c.form, -1, 1);
  return ({ round: 0, square: 0.7, pointed: -0.7, cleft: 0.3 } as const)[c.symphysis];
}

/**
 * BORDURE INFÉRIEURE DE LA MANDIBULE, dérivée des repères 2D du moteur de visage (cohérence 2D ↔ 3D) : du gonion (hauteur `lm.outline.keys.gonion`, juste derrière le conduit auditif)
 * au menton (bas du contour, z du menton du profil). Au-dessus du gonion la branche montante (ramus) penche vers l'arrière de ~8°.
 */
export interface JawCtx { readonly yG: number; readonly zG: number; readonly yMen: number; readonly zMen: number }
export function jawCtx(e: EngineHead): JawCtx {
  const yMen = fy(e.lm.outline.bottomY), men = skinPoints(e).get('menton')!;
  return { yG: clamp(fy(e.lm.outline.keys.gonion.y), 0.78, yMen - 0.08), zG: (e.fit as { zPorion: number }).zPorion - 0.045, yMen, zMen: men.z };
}
const RAMUS_TAN = Math.tan((8 * Math.PI) / 180), BORDER_GAMMA = 0.9;
/** z de la bordure inférieure de la mandibule à la hauteur y (monotone : croît du gonion au menton ; en dessous du gonion elle suit le ramus). */
export const borderZ = (c: JawCtx, y: number): number => (y <= c.yG ? c.zG - (c.yG - y) * RAMUS_TAN : c.zG + (c.zMen - c.zG) * ((y - c.yG) / (c.yMen - c.yG)) ** BORDER_GAMMA);

export interface JawFields { readonly zw: number; readonly pf: number; readonly qf: number }

/** Champs de forme d'une rangée y (U) pour une avant `zf`, un arrière `zb` et le centre `zc` de l'ellipse d'origine ; `null` au-dessus du mélange (l'ellipse d'origine est conservée). */
export function jawFields(e: EngineHead, y: number, zf: number, zb: number, sp: JawShapeParams = JAW_SHAPE, ctx: JawCtx = jawCtx(e)): JawFields | null {
  const k = smooth((y - sp.y0) / (sp.y1 - sp.y0));
  if (k <= 0) return null;
  const taper = clamp(e.p.jaw.taper, 0, 1), loose = 1 - taper;
  const wf = sp.wf0 + sp.wfSlope * loose, pfJ = sp.pf0 + sp.pfSlope * loose;
  const qfJ = 2 + sp.qfForm * chinForm(e) * smooth((y - sp.chinY0) / (sp.chinY1 - sp.chinY0));
  const zc = (zf + zb) / 2, zwJ = clamp(Math.max(borderZ(ctx, y), zb + wf * (zf - zb)), zb + 0.02, zf - 0.04);
  return { zw: zc + (zwJ - zc) * k, pf: 2 + (pfJ - 2) * k, qf: 2 + (qfJ - 2) * k };
}
