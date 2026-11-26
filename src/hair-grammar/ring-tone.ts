import { lumaOf } from '../core/shade';
import { MEASURED } from './ring-measures';

/**
 * OPACITÉ DE L'OMBRE AVAL SELON LE TON de la mèche (passe 7).
 * Sur la référence 60 l'ombre aval creuse la luminance d'une part RELATIVE constante (−34 / −36 / −33 % sur les panneaux A, B, C), quelle que soit la teinte. Avec une opacité fixe (0,12 par palier),
 * le creux relatif dépend du ton : sur un remplissage clair (#f3f1ee) il n'atteignait que −25 % — la bande se lisait mal —, et sur un remplissage plus sombre que l'ombre elle-même il serait négatif.
 * Pour un remplissage de luma Y sous une ombre de luma Ys, trois paliers d'opacité a cumulent A = 1 − (1 − a)³ ; le creux relatif vaut A·(Y − Ys)/Y. On résout A pour qu'il égale la mesure.
 * Luma sRGB 0,299 R + 0,587 G + 0,114 B, dans l'espace où la référence a été mesurée et où SVG compose l'opacité (pas de conversion en lumière linéaire).
 * Bornes : au-dessus de 0,2 l'ombre masquerait le liseré du bord ; sous 0,12 (opacité historique) elle ne se lirait plus. Remplissage PLUS SOMBRE que l'ombre (ton « sombre » de l'encre : #26262a sous #35353b) : l'ombre l'ÉCLAIRCISSAIT de 12,6 % — une ombre ne doit jamais éclaircir ; l'opacité est alors 0 et le palier n'est pas dessiné.
 */
/** Ombre en TROIS PALIERS (passes 6–7, retour arrière `profile: 'steps'`). L'ombre lisse de la passe 8 utilise `core/shade.ts` (`peakShadeOpacity`). */
const luma = lumaOf;

export const SHOULDER_BASE = 0.12;
export const SHOULDER_MAX = 0.2;
const STEPS = 3;

/** Opacité de chaque palier d'ombre pour un remplissage `fill` sous l'ombre `shadow` ; `SHOULDER_BASE` si les couleurs ne sont pas des `#rrggbb` (rendu historique) ; 0 si le remplissage est trop sombre pour qu'un creux se voie. */
export function shoulderOpacityFor(fill: string, shadow: string, target: number = -MEASURED.dip.C): number {
  let y: number; let ys: number;
  try { y = luma(fill); ys = luma(shadow); } catch { return SHOULDER_BASE; }
  if (y - ys < 10) return 0;
  const total = Math.min(0.6, (target * y) / (y - ys));
  const a = 1 - (1 - total) ** (1 / STEPS);
  return Math.min(SHOULDER_MAX, Math.max(SHOULDER_BASE, a));
}

/** Creux relatif de luminance obtenu par trois paliers d'opacité `a` d'une ombre `shadow` sur `fill` (négatif = plus sombre) : la grandeur comparée à la mesure. */
export function shoulderDip(fill: string, shadow: string, a: number): number {
  const y = luma(fill); const ys = luma(shadow); const total = 1 - (1 - a) ** STEPS;
  return (total * (ys - y)) / y;
}
