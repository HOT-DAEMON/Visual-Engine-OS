import { luminance } from '../../../core/color';
import { el, urlRef } from '../../../core/svg';

/**
 * Seuil de l'encrage ADAPTÉ À LA PEAU : 82 % de la luminance de la peau en valeur sRGB (bornée 0,2–0,75). Un seuil fixe noircit entièrement une peau sombre (défaut constaté : seuil 0,7 sur une peau
 * de luminance 0,45 = visage tout noir) ; relatif à la peau, la peau éclairée reste blanche et seules les ombres passent au noir.
 */
// `luminance` est en lumière LINÉAIRE ; le filtre travaille en sRGB : on repasse en valeur sRGB (gamma 2,2) avant d'appliquer les 82 %.
export const inkThreshold = (skinHex: string): number => Math.max(0.2, Math.min(0.75, 0.82 * luminance(skinHex) ** (1 / 2.2)));

/**
 * MODE DE RENDU `ink` (encrage noir et blanc) : un filtre SVG appliqué APRÈS le dessin. Il n'a aucune connaissance de l'anatomie : niveaux de gris, puis seuil
 * (tout ce qui est plus sombre que `threshold` devient noir, le reste blanc). C'est la preuve qu'une même géométrie peut recevoir un autre traitement sans être reconstruite.
 */
export function inkFilter(id: string, W: number, H: number, threshold = 0.45): { defs: string[]; ref: string } {
  const fid = `${id}-ink`;
  // Table discrète de 10 pas : les `n0` premiers pas valent 0 (noir), les suivants 1 (blanc) ; le seuil tombe à n0 / 10.
  const n0 = Math.max(1, Math.min(9, Math.round(threshold * 10)));
  const table = Array.from({ length: 10 }, (_, i) => (i < n0 ? 0 : 1)).join(' ');
  const fn = (t: string): string => el(t, { type: 'discrete', tableValues: table });
  const defs = [el('filter', { id: fid, filterUnits: 'userSpaceOnUse', x: -W, y: -H, width: 2 * W, height: 3 * H, 'color-interpolation-filters': 'sRGB' }, [el('feColorMatrix', { type: 'saturate', values: 0 }), el('feComponentTransfer', {}, [fn('feFuncR'), fn('feFuncG'), fn('feFuncB')])])];
  return { defs, ref: urlRef(fid) };
}
