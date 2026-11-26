import { parseHex } from './color';

/**
 * OPACITÉ DE CRÊTE D'UNE OMBRE POSÉE SUR UN REMPLISSAGE (passe 8) — module neutre, partagé par le moteur de grammaire (`hair-grammar/paint-pro.ts`) et le rendu principal
 * (`render/face/hair-ring.ts`) : aucun des deux n'importe l'autre.
 * Une ombre de luma Ys posée à l'opacité A sur un remplissage de luma Y donne Y' = Y + A·(Ys − Y) ; son creux RELATIF est A·(Ys − Y)/Y. La référence 60 creuse d'une part relative
 * constante (−33,5 %, `ring-measures.ts`) quel que soit le ton : on résout A pour cette cible. Luma sRGB 0,299 R + 0,587 G + 0,114 B, dans l'espace où SVG compose l'opacité.
 * Une ombre ne doit jamais éclaircir : si le remplissage est (presque) aussi sombre que l'ombre (écart < 10), l'opacité est 0 et l'ombre n'est pas dessinée.
 */
export const PEAK_SHADE_MAX = 0.6;
/** Opacité de repli quand une couleur n'est pas un `#rrggbb` (même ordre de grandeur que le résultat sur un ton clair : 0,43). */
export const PEAK_SHADE_FALLBACK = 0.4;

export const lumaOf = (hex: string): number => { const c = parseHex(hex); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; };

/** Opacité de crête pour obtenir le creux relatif `target` (négatif) ; bornée à `PEAK_SHADE_MAX`, 0 si le remplissage est trop sombre pour qu'un creux se voie. */
export function peakShadeOpacity(fill: string, shadow: string, target = -0.335): number {
  let y: number; let ys: number;
  try { y = lumaOf(fill); ys = lumaOf(shadow); } catch { return PEAK_SHADE_FALLBACK; }
  if (!(y - ys >= 10)) return 0;
  return Math.min(PEAK_SHADE_MAX, (-target * y) / (y - ys));
}

/** Creux relatif réellement obtenu avec l'opacité `a` (négatif = plus sombre) : la grandeur comparée à la mesure. */
export const shadeDip = (fill: string, shadow: string, a: number): number => (a * (lumaOf(shadow) - lumaOf(fill))) / lumaOf(fill);
